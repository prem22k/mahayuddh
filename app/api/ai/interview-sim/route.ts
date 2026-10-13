import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/service";
import { getAiGate } from "@/lib/ai/gate";
import { askInterviewSim } from "@/lib/ai/bounded";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/interview-sim
 *   { squadId, problemSlug?, problemTitle?, approach?, firstQuestion? }
 *
 * Step 25 #5 / §45.
 *
 * One follow-up question, not a chat. There is no conversation state anywhere in
 * this feature: a stored transcript of somebody's reasoning is a store of their
 * mistakes, and this product has no use for one. `firstQuestion: false` is
 * refused in the module rather than here, so the rule cannot be bypassed by
 * calling this route differently.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "/api/ai/interview-sim");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({
    ...RATE_RULES.aiCall,
    key: rateLimitKey("aiCall", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/ai/interview-sim",
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
  const approach = typeof body.approach === "string" ? body.approach.slice(0, 8000) : null;
  const firstQuestion = body.firstQuestion !== false;

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

    const result = await askInterviewSim({
      squadId: gate.squadId,
      userId: user.id,
      aiEnabled: gate.aiEnabled,
      remainingBudget: gate.remainingBudget,
      problemTitle,
      approach,
      firstQuestion,
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
      route: "/api/ai/interview-sim",
      actor_id: user.id,
      detail: "unhandled gate failure",
    });
    console.error("interview-sim failure:", err);
    return NextResponse.json(
      { error: "Something went wrong reaching the assistant." },
      { status: 500 }
    );
  }
}