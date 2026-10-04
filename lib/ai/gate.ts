/**
 * SERVER ONLY. Imported by app/api/ai/stuck-assistant and nothing else.
 *
 * The service client imports lib/supabase/server.ts, which needs next/headers.
 * A client component importing this module drags that into the browser bundle
 * and fails the build — which is the third time this codebase has hit that,
 * so the boundary is stated here rather than discovered again.
 *
 * It also matters for integrity, not just bundling: ai_calls has no client
 * INSERT policy, on purpose, so a bug in a client cannot fabricate usage and
 * the ladder check cannot be bypassed by simply not writing the row.
 */
import { createClient } from "@/lib/supabase/client";
import { getServiceClient } from "@/lib/supabase/service";
import {
  AI_CALLS_PER_HOUR,
  decideStuckAssistant,
  isProviderConfigured,
  practiceNextFromRecommendation,
  sanitizeAnswer,
  type AiDecision,
  type AiFeature,
  type AiOutcome,
} from "./policy.ts";
import { askLadder, readProviderConfig } from "./provider.ts";
import type { StuckLevel } from "@/types/database";
import { DataError } from "@/lib/data/errors";

/**
 * AI gate (Step 25, Bible §45).
 *
 * Every AI call in this app goes through here. Nothing else talks to a model.
 *
 * Three layers, deliberately, because the one that matters is a promise to the
 * user:
 *
 *   1. decideStuckAssistant — pure policy: is this call allowed, and at what
 *      ladder ceiling?
 *   2. clampAnswerLevel + stripCodeBlocks — the model does not always obey. A
 *      nudge request that comes back containing the solution is pulled back
 *      here rather than shown.
 *   3. The ai_calls trigger in Postgres — the same ceiling checked again in the
 *      database, so a caller that bypasses this file still cannot log an answer
 *      above the level that was asked for.
 *
 * Every outcome is logged, refusals included. A guardrail nobody can audit is a
 * guardrail that quietly stopped working, and `refused` rows are the only
 * evidence that the ladder is holding.
 */

export interface GateContext {
  squadId: string | null;
  aiEnabled: boolean;
  remainingBudget: number;
}

/** Read the gate's state for a squad. */
export async function getAiGate(squadId: string | null): Promise<GateContext> {
  if (!squadId) {
    return { squadId: null, aiEnabled: false, remainingBudget: 0 };
  }
  const supabase = createClient();
  const [{ data: squad }, { data: remaining }] = await Promise.all([
    supabase.from("squads").select("ai_enabled").eq("id", squadId).maybeSingle(),
    supabase.rpc("ai_calls_remaining", { p_squad: squadId }),
  ]);
  return {
    squadId,
    // Default OFF. A squad with no row, or with the column false, gets false.
    aiEnabled: Boolean((squad as { ai_enabled: boolean } | null)?.ai_enabled),
    remainingBudget: typeof remaining === "number" ? remaining : AI_CALLS_PER_HOUR,
  };
}

async function logCall(row: {
  squadId: string | null;
  /**
   * The authenticated user, passed in from the route.
   *
   * It has to be passed: a browser Supabase client cannot read a session
   * server-side, so asking it for the user here returned null and every
   * ai_calls row was unattributed — which defeats the point of a log nobody
   * can tie to a person.
   */
  userId: string | null;
  feature: AiFeature;
  requestedLevel: StuckLevel | null;
  answeredLevel: StuckLevel | null;
  outcome: AiOutcome;
  refusalReason?: string | null;
  inputChars?: number;
  outputChars?: number;
  latencyMs?: number;
}): Promise<void> {
  const supabase = getServiceClient();
  // No service client means no logging, and never a failed user flow because
  // of it. The ladder is enforced in the client layer regardless.
  if (!supabase) return;

  const { error } = await supabase.from("ai_calls").insert({
    squad_id: row.squadId,
    user_id: row.userId,
    feature: row.feature,
    requested_level: row.requestedLevel,
    answered_level: row.answeredLevel,
    outcome: row.outcome,
    refusal_reason: row.refusalReason ?? null,
    input_chars: row.inputChars ?? null,
    output_chars: row.outputChars ?? null,
    latency_ms: row.latencyMs ?? null,
  });
  if (error) console.warn("ai_calls insert failed:", error.message);
}

export interface StuckAssistantResult {
  decision: AiDecision;
  /** Present only when decision.allowed. Already clamped and stripped. */
  answer?: string;
  level?: StuckLevel;
  /** True when the model's output had to be pulled back. */
  pulledDown?: boolean;
}

/**
 * Ask the stuck assistant.
 *
 * No provider is wired up, so a permitted call cannot be completed: the honest
 * outcome is `no_provider`, and the user is pointed at the ladder and their
 * squad-mates. The gate, the clamp and the logging all run, because those are
 * what need to work before a provider exists.
 *
 * When a provider is added it goes in exactly one place — the marked seam below
 * — and everything above it stays.
 */
export async function askStuckAssistant(params: {
  squadId: string | null;
  /** From the resolved session. Never read from a client on the server. */
  userId: string | null;
  aiEnabled: boolean;
  remainingBudget: number;
  problemSlug: string;
  requestedLevel: StuckLevel;
  request?: string;
  /** The user's own scratchpad, if any. Never required. */
  scratchpad?: string | null;
}): Promise<StuckAssistantResult> {
  const decision = decideStuckAssistant({
    aiEnabled: params.aiEnabled,
    requestedLevel: params.requestedLevel,
    remainingBudget: params.remainingBudget,
    request: params.request,
    providerConfigured: isProviderConfigured(),
  });

  if (!decision.allowed) {
    await logCall({
      squadId: params.squadId,
      userId: params.userId,
      feature: "stuck_assistant",
      requestedLevel: params.requestedLevel,
      answeredLevel: null,
      outcome: decision.outcome,
      inputChars: params.request?.length ?? 0,
    });
    return { decision };
  }

  // ── The seam ─────────────────────────────────────────────────────────────
  // A provider call belongs here and nowhere else. It must receive
  // SYSTEM_PREAMBLE, must be told the requested level, and its output must go
  // through sanitizeAnswer before anything is shown to a user.
  //
  // Unreachable while no provider is configured: decideStuckAssistant refuses
  // with outcome 'no_provider' before reaching here, which is why the provider
  // call is a separate function rather than an inline stub.
  //
  // ProviderError from askLadder propagates to the route, which reports it as a
  // sentence. It must NOT be logged into ai_calls as an answer, and must not be
  // swallowed into an empty hint.
  const startedAt = Date.now();
  const raw = await callProvider({
    requestedLevel: params.requestedLevel,
    // The ladder route sends a slug, not a title, so that is what the model is
    // told. Naming the pattern is enough context for a hint and cannot be used to
    // smuggle a solution past the level ceiling.
    problemTitle: params.problemSlug,
    userText: params.request,
    scratchpad: params.scratchpad ?? null,
  });

  const clean = sanitizeAnswer(params.requestedLevel, raw);

  await logCall({
    squadId: params.squadId,
    userId: params.userId,
    feature: "stuck_assistant",
    requestedLevel: params.requestedLevel,
    // Log what was actually shown, not what the model claimed.
    answeredLevel: clean.level,
    outcome: clean.pulledDown ? "refused" : "ok",
    refusalReason: clean.pulledDown ? "model answered above the requested ladder level" : null,
    inputChars: (params.request?.length ?? 0) + (params.scratchpad?.length ?? 0),
    outputChars: clean.text.length,
    latencyMs: Date.now() - startedAt,
  });

  return {
    decision,
    answer: clean.text,
    level: clean.level,
    pulledDown: clean.pulledDown,
  };
}

/**
 * The provider seam.
 *
 * Separate from askStuckAssistant so the "no provider configured" case is a
 * thrown error at a single named place rather than a branch that quietly does
 * nothing. It must not be reached while isProviderConfigured() is false, and
 * tests/integration/aiGates.mjs asserts exactly that.
 */
async function callProvider(params: {
  requestedLevel: StuckLevel;
  problemTitle?: string | null;
  userText?: string | null;
  scratchpad?: string | null;
}): Promise<{ level: StuckLevel; text: string }> {
  const config = readProviderConfig();
  if (!config) {
    // Same ordering invariant as before, now against the config the provider
    // module actually reads rather than the boolean that was standing in for it.
    throw new Error(
      "callProvider reached with no provider configured. decideStuckAssistant should have refused first — this is a bug in the gate ordering."
    );
  }

  // The provider module owns the wire format, the preamble, the timeout, the
  // output cap and the error scrubbing. This function's whole remaining job is
  // to pass the ladder level through, because askLadder builds the instruction
  // from it.
  return askLadder({
    config,
    requestedLevel: params.requestedLevel,
    problemTitle: params.problemTitle,
    userText: params.userText,
    scratchpad: params.scratchpad,
  });
}

// Re-exported so call sites have one AI entry point, while the testable logic
// lives in the alias-free policy module (the node test runner cannot resolve
// "@/", so anything imported from here cannot be unit tested).
// `practiceNextFromRecommendation` is imported so it stays part of this module's
// public surface even though nothing here calls it yet.
void practiceNextFromRecommendation;

export { AI_CALLS_PER_HOUR, sanitizeAnswer, practiceNextFromRecommendation, isProviderConfigured };
export type { AiDecision };
export { DataError as AiGateError };