import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/service";
import { askStuckAssistant, getAiGate } from "@/lib/ai/gate";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";
import type { StuckLevel } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/stuck-assistant
 *   { squadId, problemSlug, requestedLevel, request?, scratchpad? }
 *
 * Step 25 / §45.
 *
 * Server-side for two reasons that are really one reason:
 *
 *   - ai_calls has no client INSERT policy, so every AI call is logged here. A
 *     client bug cannot fabricate usage, and the ladder ceiling cannot be
 *     bypassed by simply not writing the row.
 *   - the gate reads the squad's ai_enabled flag and its remaining budget from
 *     the database rather than trusting anything the client sent.
 *
 * requestedLevel is validated against the ladder rather than passed through: an
 * unrecognised level makes the ceiling comparison undefined, and "undefined
 * ceiling" is not a state this feature should have.
 *
 * `squadId` is verified as a squad the caller is actually in, inside getAiGate.
 */
const LEVELS: StuckLevel[] = ["nudge", "pattern", "direction", "full"];

export async function POST(request: Request) {
  const auth = await requireUser(request, "/api/ai/stuck-assistant");
  if (auth.response) return auth.response;
  const user = auth.user;

  // Per-account ceiling on top of the per-squad budget in Postgres. Without it,
  // one member cycling squad ids spends other people's allowance.
  const limit = rateLimit({
    ...RATE_RULES.aiCall,
    key: rateLimitKey("aiCall", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/ai/stuck-assistant",
      actor_id: user.id,
    });
    return NextResponse.json(
      { error: "Too many AI requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  // Bounded parse: a 100MB body is rejected before it is JSON.parse'd, rather
  // than after being read into memory and then sliced down to 20k characters.
  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const squadId = typeof body.squadId === "string" && body.squadId ? body.squadId : null;
  const problemSlug = typeof body.problemSlug === "string" ? body.problemSlug : "";
  const requestedLevel = body.requestedLevel as StuckLevel;
  const asked = typeof body.request === "string" ? body.request.slice(0, 2000) : "";
  const scratchpad = typeof body.scratchpad === "string" ? body.scratchpad.slice(0, 20000) : "";

  if (!LEVELS.includes(requestedLevel)) {
    return NextResponse.json({ error: "Unknown ladder level." }, { status: 400 });
  }
  if (!/^[a-z0-9-]{1,80}$/.test(problemSlug)) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 400 });
  }

  try {
    const gate = await getAiGate(squadId, user.id);

    if (gate.notAMember) {
      // Refuse rather than silently downgrade to "AI is off": the caller asked a
      // question, and an honest 403 is better than a squad-mate suggestion that
      // explains nothing.
      return NextResponse.json(
        { error: "You are not a member of that squad." },
        { status: 403 }
      );
    }

    const result = await askStuckAssistant({
      squadId: gate.squadId,
      // Resolved from the request above, so the ai_calls row is attributable.
      userId: user.id,
      aiEnabled: gate.aiEnabled,
      remainingBudget: gate.remainingBudget,
      problemSlug,
      requestedLevel,
      request: asked,
      scratchpad,
    });

    return NextResponse.json({
      allowed: result.decision.allowed,
      outcome: result.decision.outcome,
      message: result.decision.message,
      answer: result.answer ?? null,
      level: result.level ?? null,
      pulledDown: Boolean(result.pulledDown),
    });
  } catch (err) {
    // Provider errors already carry a message written for a person and are
    // scrubbed of anything upstream. Anything else here is ours — a database
    // error, a bug — and its text can name tables, columns and internal hosts.
    // Logged in full, returned as a sentence.
    logSecurityEvent("input.rejected", {
      route: "/api/ai/stuck-assistant",
      actor_id: user.id,
      detail: "unhandled gate failure",
    });
    console.error("stuck-assistant failure:", err);
    return NextResponse.json(
      { error: "Something went wrong reaching the assistant." },
      { status: 500 }
    );
  }
}