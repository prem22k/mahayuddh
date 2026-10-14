import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/service";
import { getAiGate } from "@/lib/ai/gate";
import { askExplainBack } from "@/lib/ai/bounded";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/explain-back
 *   { squadId, problemSlug?, problemTitle?, explanation }
 *
 * Step 25 #4 / §45.
 *
 * §45's "explain back" is the one feature that exists to check understanding
 * rather than to give information, so the response must be about their reasoning
 * and not about the problem. That constraint is in the instruction; this route
 * only has to not undermine it, which means not accepting an explanation short
 * enough to be a title.
 *
 * The explanation is the member's own writing. It is not stored here.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "/api/ai/explain-back");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({
    ...RATE_RULES.aiCall,
    key: rateLimitKey("aiCall", { userId: user.id }),
  });
  if (!limit.ok) {
    logSecurityEvent("rate_limit.exceeded", {
      route: "/api/ai/explain-back",
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
  const explanation = typeof body.explanation === "string" ? body.explanation.slice(0, 8000) : "";

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

    const result = await askExplainBack({
      squadId: gate.squadId,
      userId: user.id,
      aiEnabled: gate.aiEnabled,
      remainingBudget: gate.remainingBudget,
      problemTitle,
      explanation,
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
      route: "/api/ai/explain-back",
      actor_id: user.id,
      detail: "unhandled gate failure",
    });
    console.error("explain-back failure:", err);
    return NextResponse.json(
      { error: "Something went wrong reaching the assistant." },
      { status: 500 }
    );
  }
}