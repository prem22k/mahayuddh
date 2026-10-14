/**
 * The three §45 features that are not ladder hints.
 *
 * Split from lib/ai/gate.ts because that module is the ladder's story — level in,
 * level out, clamped three times. These three have no level. They share the gate
 * ordering, the budget and the logging, and that is all they share.
 *
 * What they have in common with each other, and why they are one file:
 *
 *   - each one reads something the member already wrote (a scratchpad, an
 *     approach, a battle) and says something small about it;
 *   - none of them may return code, because §45's objection is AI that finishes
 *     the work, and "here is your approach rewritten" finishes the work just as
 *     effectively as "here is the solution";
 *   - every one of them is a single round trip. There is no conversation state,
 *     because a stored transcript of somebody's reasoning is a store of their
 *     mistakes and this product does not need one.
 *
 * The gates that must hold, in order, exactly as for the ladder:
 *
 *   1. ai_enabled — default off
 *   2. squad budget — a refusal must not consume it
 *   3. provider configured
 *   4. the §45 refusal list, which applies to these too: asking for
 *      "explain my mistake" while saying "just give me the solution" is still a
 *      request for a solution
 *   5. the call
 *   6. strip code out of whatever came back, and log what was actually shown
 *
 * Server only, like gate.ts: ai_calls has no client INSERT policy on purpose.
 */

import { getServiceClient } from "@/lib/supabase/service";
import { decideStuckAssistant, isProviderConfigured, stripCodeBlocks } from "./policy.ts";
import {
  askBounded,
  LEVEL_INSTRUCTION,
  ProviderError,
  readProviderConfig,
} from "./provider.ts";
import type { AiFeature, AiOutcome } from "./policy.ts";

export interface BoundedResult {
  allowed: boolean;
  outcome: AiOutcome;
  /** Written to be read by a person, not logged and forgotten. */
  message: string;
  /** Present only when allowed. Code-stripped. */
  text?: string;
  /** True when the model returned code and it was removed. */
  stripped?: boolean;
}

interface BoundedParams {
  squadId: string | null;
  userId: string | null;
  aiEnabled: boolean;
  remainingBudget: number;
  feature: AiFeature;
  /** The member's own words. Never required; absent input still gets an honest refusal. */
  input?: string | null;
  /** Extra context, e.g. the problem title. */
  context?: string | null;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function log(row: {
  squadId: string | null;
  userId: string | null;
  feature: AiFeature;
  outcome: AiOutcome;
  refusalReason?: string | null;
  inputChars?: number;
  outputChars?: number;
  latencyMs?: number;
}): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  const { error } = await supabase.from("ai_calls").insert({
    squad_id: row.squadId,
    user_id: row.userId,
    feature: row.feature,
    outcome: row.outcome,
    refusal_reason: row.refusalReason ?? null,
    input_chars: row.inputChars ?? null,
    output_chars: row.outputChars ?? null,
    latency_ms: row.latencyMs ?? null,
  });
  if (error) console.warn("ai_calls insert failed:", error.message);
}

/**
 * Shared body of the three features.
 *
 * The ladder's decideStuckAssistant is reused rather than reimplemented, with
 * requestedLevel fixed to "nudge": it carries the enabled, budget, provider and
 * refusal-ordering logic, and this is the only way to guarantee the ordering
 * cannot drift between the four features. A refusal here reports the ladder
 * level as null, because these features do not have one.
 */
async function run(
  params: BoundedParams,
  buildInstruction: () => string,
): Promise<BoundedResult> {
  const inputChars = (params.input ?? "").length + (params.context ?? "").length;

  const decision = decideStuckAssistant({
    aiEnabled: params.aiEnabled,
    // Not a ladder request. "nudge" is the least-privilege value and is never
    // reported upward, because BoundedResult has no level field.
    requestedLevel: "nudge",
    remainingBudget: params.remainingBudget,
    request: params.input ?? undefined,
    providerConfigured: isProviderConfigured(),
  });

  if (!decision.allowed) {
    await log({
      squadId: params.squadId,
      userId: params.userId,
      feature: params.feature,
      outcome: decision.outcome,
      inputChars,
    });
    return { allowed: false, outcome: decision.outcome, message: decision.message };
  }

  const config = readProviderConfig();
  if (!config) {
    // isProviderConfigured() and readProviderConfig() read the same variables, so
    // this is unreachable. It is here because "unreachable" should be a throw,
    // not a silent empty string shown to somebody who asked a real question.
    await log({
      squadId: params.squadId,
      userId: params.userId,
      feature: params.feature,
      outcome: "error",
      inputChars,
    });
    return {
      allowed: false,
      outcome: "error",
      message: "AI is misconfigured on this deployment.",
    };
  }

  const startedAt = Date.now();
  try {
    const raw = await askBounded({ config, instruction: buildInstruction() });
    const clean = stripCodeBlocks(raw);

    if (clean.text.length === 0) {
      await log({
        squadId: params.squadId,
        userId: params.userId,
        feature: params.feature,
        outcome: "refused",
        refusalReason: "model returned only code, which §45 does not allow",
        inputChars,
        latencyMs: Date.now() - startedAt,
      });
      return {
        allowed: false,
        outcome: "refused",
        message:
          "That answer was code, and this feature does not give code. Ask a squad-mate instead — they can explain it in a way that sticks.",
      };
    }

    await log({
      squadId: params.squadId,
      userId: params.userId,
      feature: params.feature,
      outcome: clean.stripped ? "refused" : "ok",
      refusalReason: clean.stripped ? "model returned code, which was stripped" : null,
      inputChars,
      outputChars: clean.text.length,
      latencyMs: Date.now() - startedAt,
    });

    return {
      allowed: true,
      outcome: clean.stripped ? "ok" : "ok",
      message: "",
      text: clean.text,
      stripped: clean.stripped,
    };
  } catch (err) {
    // ProviderError carries a message written for a person; anything else is an
    // unexpected failure and is reported as such without its detail.
    const known = err instanceof ProviderError;
    await log({
      squadId: params.squadId,
      userId: params.userId,
      feature: params.feature,
      outcome: "error",
      refusalReason: known ? (err as ProviderError).detail : "unexpected provider failure",
      inputChars,
      latencyMs: Date.now() - startedAt,
    });
    return {
      allowed: false,
      outcome: "error",
      message: known
        ? (err as ProviderError).message
        : "Something went wrong reaching the AI provider.",
    };
  }
}

/**
 * Explain my mistake (§45, Step 25 #2).
 *
 * Reads a failed battle's scratchpad and names the concept it missed. It does not
 * rewrite the code, and an empty scratchpad is refused rather than answered from
 * the problem title alone — "you did not write down what you tried" is the
 * actionable response, and it is true.
 */
export async function askExplainMistake(params: {
  squadId: string | null;
  userId: string | null;
  aiEnabled: boolean;
  remainingBudget: number;
  problemTitle?: string | null;
  scratchpad?: string | null;
}): Promise<BoundedResult> {
  const scratchpad = (params.scratchpad ?? "").trim();
  if (scratchpad.length < 20) {
    await log({
      squadId: params.squadId,
      userId: params.userId,
      feature: "explain_mistake",
      outcome: "refused",
      refusalReason: "no scratchpad to explain",
      inputChars: scratchpad.length,
    });
    return {
      allowed: false,
      outcome: "refused",
      message:
        "There is nothing written down for this attempt. Write what you tried while you are still stuck, and this can tell you which part to look at.",
    };
  }

  return run(
    { ...params, feature: "explain_mistake", input: scratchpad },
    () =>
      [
        LEVEL_INSTRUCTION.explain_mistake,
        `The problem was ${params.problemTitle ?? "unspecified"}.`,
        `Their scratchpad:\n${clip(scratchpad, 3000)}`,
      ].join("\n"),
  );
}

/**
 * Explain-back (§45, Step 25 #4).
 *
 * Asks the member to explain their approach, then responds to what they said.
 * The draft is their own writing, so the instruction carries the same "do not
 * rewrite" rule as the others.
 */
export async function askExplainBack(params: {
  squadId: string | null;
  userId: string | null;
  aiEnabled: boolean;
  remainingBudget: number;
  problemTitle?: string | null;
  /** The member's explanation, in their own words. */
  explanation: string;
}): Promise<BoundedResult> {
  const explanation = params.explanation.trim();
  if (explanation.length < 20) {
    return {
      allowed: false,
      outcome: "refused",
      message: "Write the explanation first — there is nothing to respond to yet.",
    };
  }

  return run(
    { ...params, feature: "explain_back", input: explanation },
    () =>
      [
        LEVEL_INSTRUCTION.explain_back,
        `The problem was ${params.problemTitle ?? "unspecified"}.`,
        `What they said:\n${clip(explanation, 3000)}`,
      ].join("\n"),
  );
}

/**
 * Interview sim (§45, Step 25 #5).
 *
 * One follow-up question about a real weakness. Not a chat: asking a second
 * question after the first is a different feature and a different retention
 * question, so the response to more than one round is "one at a time".
 */
export async function askInterviewSim(params: {
  squadId: string | null;
  userId: string | null;
  aiEnabled: boolean;
  remainingBudget: number;
  problemTitle?: string | null;
  approach?: string | null;
  /** False once the member has already had a question. */
  firstQuestion?: boolean;
}): Promise<BoundedResult> {
  if (params.firstQuestion === false) {
    return {
      allowed: false,
      outcome: "refused",
      message: "One question at a time. Answer the one you have, then come back for the next.",
    };
  }

  return run(
    { ...params, feature: "interview_sim", input: params.approach ?? "" },
    () =>
      [
        LEVEL_INSTRUCTION.interview_sim,
        `The problem was ${params.problemTitle ?? "unspecified"}.`,
        params.approach
          ? `Their approach:\n${clip(params.approach, 3000)}`
          : "They have not written an approach yet, so ask what their plan would be.",
      ].join("\n"),
  );
}

/** Exported for the routes' budget display; keeps the SQL constant in one place. */
export { AI_CALLS_PER_HOUR } from "./policy.ts";