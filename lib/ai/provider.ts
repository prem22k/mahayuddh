/**
 * Model provider client (Step 25, Bible §45).
 *
 * SERVER ONLY. Imported by lib/ai/gate.ts and nothing else.
 *
 * §45's rule is that AI should increase thinking. That obligation is discharged
 * here, in one place, rather than in each feature:
 *
 *   - the §45 preamble goes in on every call, so a new feature cannot ship
 *     without it;
 *   - the ladder level is part of the instruction, not a hope;
 *   - the model's own claimed level is parsed and then re-checked by the caller,
 *     which clamps it and the database trigger checks it a third time;
 *   - there is a timeout and an output cap, because a model that streams for
 *     ninety seconds into a stuck-ladder hint is worse than no answer;
 *   - provider errors are not surfaced verbatim. A leaked upstream message is a
 *     leaked key, an internal hostname, or a provider's prompt echoed back.
 *
 * Deliberately NOT here:
 *
 *   - streaming. A hint that arrives in three words at a time is worse to read
 *     than one that arrives whole, and the guardrails are easier to enforce on a
 *     complete response.
 *   - retries. A retry against a provider that already billed for the first
 *     attempt is a cost decision, not an engineering one.
 *   - a model choice. Whatever the deployment points at is what runs.
 *
 * Two wire formats, because the providers anybody actually uses are not the
 * same API. `AI_PROVIDER` picks; the default is inferred from which key is set.
 * Where it points and which model it runs are deployment settings only:
 * AI_BASE_URL and AI_MODEL are required, with no defaults in code.
 * Gemini rides the OpenAI-compatible wire (Google's documented
 * /v1beta/openai/ endpoint speaks chat/completions with Bearer auth), so it
 * inherits the timeout, output cap, envelope parsing, and error scrubbing
 * with zero new code paths.
 */

import { SYSTEM_PREAMBLE } from "./policy.ts";
import type { StuckLevel } from "@/types/database";

export type ProviderName = "openai" | "anthropic" | "gemini" | "kilo";

export interface ProviderConfig {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** Read the provider configuration from the environment, or null. */
export function readProviderConfig(): ProviderConfig | null {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  // Kilo AI Gateway (https://ai-gateway.kilo.ai): OpenAI-compatible, one key
  // for many models, including the free `kilo-auto/free` router.
  const kiloKey = process.env.KILO_API_KEY;

  const name = (process.env.AI_PROVIDER ?? "").toLowerCase();
  const chosen: ProviderName | null =
    name === "openai" || name === "anthropic" || name === "gemini" || name === "kilo"
      ? name
      : openaiKey
        ? "openai"
        : anthropicKey
          ? "anthropic"
          : geminiKey
            ? "gemini"
            : kiloKey
              ? "kilo"
              : null;
  if (!chosen) return null;

  const key =
    chosen === "openai"
      ? openaiKey
      : chosen === "anthropic"
        ? anthropicKey
        : chosen === "gemini"
          ? geminiKey
          : kiloKey;
  if (!key) return null;

  // Endpoint and model come from the deployment, never from code. Both are
  // required: AI_BASE_URL is the API root the wire format talks to (a
  // provider's API, a gateway, a local runner), AI_MODEL what it runs.
  // isProviderConfigured() requires the same two, so the gate refuses before
  // this can return null for a configured key.
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!baseUrl || !model) return null;

  return { name: chosen, apiKey: key, baseUrl: baseUrl.replace(/\/+$/, ""), model };
}

/** Config plus an optional override, used by tests pointing at a mock. */
export function providerConfigForTest(overrides: Partial<ProviderConfig>): ProviderConfig | null {
  const base = readProviderConfig();
  if (!base && !overrides.apiKey) return null;
  return {
    name: overrides.name ?? base?.name ?? "openai",
    apiKey: overrides.apiKey ?? base?.apiKey ?? "",
    // Test-only placeholders: tests always point baseUrl at a local mock.
    baseUrl: (overrides.baseUrl ?? base?.baseUrl ?? "http://127.0.0.1/unset").replace(/\/+$/, ""),
    model: overrides.model ?? base?.model ?? "test-model",
  };
}

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20000);
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS ?? 400);

/**
 * Tokens allowed for reasoning on top of the answer budget.
 *
 * Reasoning models count their hidden reasoning against `max_tokens`. Measured
 * 2026-11-03: `kilo-auto/free` routed a one-line question to a reasoning model
 * that spent 395 of a 400-token cap thinking and returned empty content
 * (finish_reason "length"); with 4000 it used ~450 reasoning + ~45 answer
 * tokens. The answer itself stays bounded by the prompt and sanitizeAnswer.
 */
const REASONING_HEADROOM: Partial<Record<ProviderName, number>> = {
  kilo: 3600,
  anthropic: 2048,
};

/** The free router is slower (9-11 s measured for a short answer). */
function timeoutFor(config: ProviderConfig): number {
  if (process.env.AI_TIMEOUT_MS) return TIMEOUT_MS;
  return config.name === "kilo" ? 45000 : TIMEOUT_MS;
}

function wireMaxTokens(config: ProviderConfig, answerTokens: number): number {
  return answerTokens + (REASONING_HEADROOM[config.name] ?? 0);
}

export class ProviderError extends Error {
  // Written out rather than as a TS parameter property: the test runner loads
  // this file with type-stripping only, which does not support that syntax.
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = "ProviderError";
    this.detail = detail;
  }
}

/**
 * Ask for a ladder hint.
 *
 * Returns the level the model says it answered at. That claim is not trusted:
 * gate.ts passes it through sanitizeAnswer, which clamps it to the requested
 * level and strips code out of the text, and the ai_calls trigger checks it again
 * in the database.
 */
export async function askLadder(params: {
  config: ProviderConfig;
  requestedLevel: StuckLevel;
  problemTitle?: string | null;
  userText?: string | null;
  scratchpad?: string | null;
}): Promise<{ level: StuckLevel; text: string }> {
  const { config, requestedLevel } = params;
  const instruction = buildLadderInstruction(requestedLevel, params);

  const raw =
    config.name === "anthropic"
      ? await callAnthropic(config, SYSTEM_PREAMBLE, instruction)
      : await callOpenAiCompatible(config, SYSTEM_PREAMBLE, instruction);

  return parseEnvelope(raw);
}

/**
 * A general §45-bounded call for the features that are not ladder hints:
 * explain_mistake, explain_back, interview_sim.
 *
 * Same preamble, same output cap, same "never rewrite their code" instruction.
 * Returns prose only — there is no ladder level to claim.
 */
export async function askBounded(params: {
  config: ProviderConfig;
  instruction: string;
  maxTokens?: number;
}): Promise<string> {
  const { config } = params;
  const raw =
    config.name === "anthropic"
      ? await callAnthropic(config, SYSTEM_PREAMBLE, params.instruction, params.maxTokens)
      : await callOpenAiCompatible(config, SYSTEM_PREAMBLE, params.instruction, params.maxTokens);
  return raw.trim();
}

// ── Instructions ─────────────────────────────────────────────────────────────

/**
 * The level is named in the instruction and the answer format is constrained to a
 * single line of JSON, so parsing does not depend on the model cooperating with
 * prose. It still might not, hence parseEnvelope's fallbacks.
 */
function buildLadderInstruction(
  level: StuckLevel,
  p: { problemTitle?: string | null; userText?: string | null; scratchpad?: string | null },
): string {
  const ask = [
    `You are helping with ${p.problemTitle ?? "a problem"}.`,
    `The developer asked for exactly the "${level}" level of help.`,
    level === "nudge"
      ? "A nudge is one short question or observation that unsticks their next thought. Not a direction, not a technique, not code."
      : level === "pattern"
        ? "A pattern is a name and a shape they should recognise. No code, no worked steps."
        : level === "direction"
          ? "A direction is what to think about next, in order. Still no code and no worked solution."
          : "They explicitly asked for a full explanation. Give a clear explanation. Still no finished code block — they are practising, not copying.",
    p.userText ? `They said: ${clip(p.userText, 1200)}` : "",
    p.scratchpad ? `Their scratchpad so far: ${clip(p.scratchpad, 3000)}` : "",
    'Reply with exactly one line of JSON: {"level":"<level>","text":"<your reply>"}',
  ];
  return ask.filter(Boolean).join("\n");
}

export const LEVEL_INSTRUCTION: Record<string, string> = {
  explain_mistake: [
    "A developer failed this attempt and wrote a scratchpad.",
    "Name the single concept their scratchpad is missing or got wrong.",
    "Do not rewrite their code. Do not present a corrected version.",
    "Point at it in one or two sentences, then ask a question that makes them find it themselves.",
  ].join(" "),
  explain_back: [
    "A developer just explained their approach out loud.",
    "Respond to what they actually said.",
    "Name one thing their reasoning got right, then one specific gap or unstated assumption.",
    "Do not rewrite the approach. Ask the question whose answer closes the gap.",
  ].join(" "),
  interview_sim: [
    "You are interviewing a developer about an approach they wrote.",
    "Ask ONE follow-up question about a specific weakness in it.",
    "If the approach is sound, ask the question a real interviewer would ask about its cost or its failure case.",
    "No praise, no summary, no rewritten solution. One question only.",
  ].join(" "),
};

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

// ── Wire calls ───────────────────────────────────────────────────────────────

async function callOpenAiCompatible(
  config: ProviderConfig,
  system: string,
  user: string,
  maxTokens = MAX_TOKENS,
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: wireMaxTokens(config, maxTokens),
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutFor(config)),
  });

  if (!res.ok) throw await providerFailure(res, config);
  const json = (await res.json()) as {
    model?: string;
    choices?: { finish_reason?: string; message?: { content?: string } }[];
  };
  const choice = json.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new ProviderError(
      "Sarathi lost the thread and came back empty. Ask again.",
      `openai-compatible response had no content (model=${config.model}` +
        (json.model && json.model !== config.model ? `, routed to ${json.model}` : "") +
        `, finish_reason=${choice?.finish_reason ?? "none"})`,
    );
  }
  return text;
}

async function callAnthropic(
  config: ProviderConfig,
  system: string,
  user: string,
  maxTokens = MAX_TOKENS,
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    // No temperature: current Claude models reject a non-default sampling value
    // with a 400. Claude Haiku 5.5 thinks by default and thinking counts against
    // max_tokens, hence the headroom and low effort for these short replies.
    body: JSON.stringify({
      model: config.model,
      max_tokens: wireMaxTokens(config, maxTokens),
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(timeoutFor(config)),
  });

  if (!res.ok) throw await providerFailure(res, config);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (text.length === 0) {
    throw new ProviderError(
      "Sarathi lost the thread and came back empty. Ask again.",
      `anthropic response had no text blocks (model=${config.model})`,
    );
  }
  return text;
}

/**
 * Turn an upstream failure into something safe to log.
 *
 * The status code is kept because it is the useful part. The body is reduced to a
 * length, not quoted: provider error bodies routinely echo the prompt and
 * sometimes the key, and an error that reaches a log or a browser is a leak.
 */
async function providerFailure(res: Response, config: ProviderConfig): Promise<ProviderError> {
  let detail = `status=${res.status} provider=${config.name} model=${config.model}`;
  try {
    const body = await res.text();
    detail += ` bodyBytes=${body.length}`;
  } catch {
    detail += " body=<unreadable>";
  }
  if (res.status === 401 || res.status === 403) {
    return new ProviderError(
      "Sarathi is away right now: the guide's connection is not set up.",
      detail,
    );
  }
  if (res.status === 429) {
    return new ProviderError(
      "Sarathi is answering a lot of people right now. Try again in a minute.",
      detail,
    );
  }
  return new ProviderError("Sarathi could not answer just now. Try again in a moment.", detail);
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const LEVELS: StuckLevel[] = ["nudge", "pattern", "direction", "full"];

/**
 * Read `{"level":...,"text":...}` out of a model response.
 *
 * Defensive on purpose. A model asked for one line of JSON will usually give one
 * line of JSON and sometimes give it wrapped in a fence or with a sentence in
 * front of it, and a hint surface that shows raw JSON because the model was
 * nearly well-behaved is worse than one that degrades to prose.
 *
 * The level defaults to "nudge" rather than to the requested level. Defaulting to
 * the requested level would let a model that ignored the instruction and
 * answered at "full" have its claim accepted; defaulting to the lowest level
 * means sanitizeAnswer sees a low claim and the ceiling holds.
 */
export function parseEnvelope(raw: string): { level: StuckLevel; text: string } {
  const text = raw.trim();

  // JSON extraction FIRST, on the raw text.
  //
  // The order matters and getting it wrong is subtle. A model told to answer with
  // one line of JSON will sometimes put a code fence inside the text value —
  // which is exactly what happens when it answers above the requested level and
  // quotes its own code. Stripping fences first found the INNER fence, threw away
  // the surrounding JSON, and fell through to the prose path with level "nudge".
  // That is a safe-looking failure that silently destroys the level claim, and it
  // is the case where the claim matters most.
  const direct = extractJson(text);
  if (direct) return direct;

  // Not JSON. It may still be JSON wrapped in a markdown fence, which is the other
  // common shape.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const wrapped = extractJson(fenced[1].trim());
    if (wrapped) return wrapped;
  }

  // Not JSON at all. The text is still a usable hint, and claiming the lowest
  // level is the safe reading of an unparseable answer.
  return { level: "nudge", text };
}

/**
 * Pull {"level":…,"text":…} out of a string, tolerating prose around it.
 *
 * Returns null rather than a default when there is no usable envelope, so the
 // caller can fall through to the fence and prose paths instead of showing raw
 * JSON to a user.
 */
function extractJson(text: string): { level: StuckLevel; text: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: { level?: unknown; text?: unknown };
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed.text !== "string" || parsed.text.trim().length === 0) return null;

  // An unrecognised level is refused rather than trusted, and the refusal is the
  // LOWEST level: defaulting to the requested level would let a model that
  // ignored the instruction have its claim accepted.
  const level = LEVELS.includes(parsed.level as StuckLevel)
    ? (parsed.level as StuckLevel)
    : "nudge";
  return { level, text: parsed.text.trim() };
}
