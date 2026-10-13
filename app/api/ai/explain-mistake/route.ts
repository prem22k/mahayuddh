import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/service";
import { getAiGate } from "@/lib/ai/gate";
import { askExplainMistake } from "@/lib/ai/bounded";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/explain-mistake
 *   { squadId, problemSlug?, problemTitle?, scratchpad }
 *
 * Step 25 #2 / §45.
 *
 * Server-side for the same reason as /api/ai/stuck-assistant: ai_calls has no
 * client INSERT policy, so every call is logged here and a client bug cannot
 * fabricate usage or skip the row that makes refusals auditable.
 *
 * The scratchpad arrives from the client because the member's own private
 * scratchpad has no reason to make a round trip through the database for this.
 * It is the member's own words about their own attempt, it is never stored by
 * this route, and it is bounded below — at the body, not after the parse.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "/api/ai/explain-mistake");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({
    ...RATE_RULES.aiCall,
    key: rateLimitKey("aiCall", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/ai/explain-mistake",
      actor_id: user.id,
    });
    return NextResponse.json(
      { error: "Too many AI requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const squadId = typeof body.squadId === "string" && body.squadId ? body.squadId : null;
  const problemSlug = typeof body.problemSlug === "string" ? body.problemSlug : "";
  const problemTitle = typeof body.problemTitle === "string" ? body.problemTitle.slice(0, 200) : null;
  const scratchpad = typeof body.scratchpad === "string" ? body.scratchpad.slice(0, 20000) : "";

  if (problemSlug && !/^[a-z0-9-]{1,80}$/.test(problemSlug)) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 400 });
  }

  try {
    const gate = await getAiGate(squadId, user.id);
    if (gate.notAMember) {
      return NextResponse.json(
        { error: "You are not a member of that squad." },
        { status: 403 }
      );
    }

    const result = await askExplainMistake({
      squadId: gate.squadId,
      userId: user.id,
      aiEnabled: gate.aiEnabled,
      remainingBudget: gate.remainingBudget,
      problemTitle,
      scratchpad,
    });

    return NextResponse.json({
      allowed: result.allowed,
      outcome: result.outcome,
      message: result.message,
      text: result.text ?? null,
      stripped: Boolean(result.stripped),
    });
  } catch (err) {
    logSecurityEvent("input.rejected", {
      route: "/api/ai/explain-mistake",
      actor_id: user.id,
      detail: "unhandled gate failure",
    });
    console.error("explain-mistake failure:", err);
    return NextResponse.json(
      { error: "Something went wrong reaching the assistant." },
      { status: 500 }
    );
  }
}