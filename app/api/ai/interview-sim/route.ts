import { NextResponse } from "next/server";
import { extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { getAiGate } from "@/lib/ai/gate";
import { askInterviewSim } from "@/lib/ai/bounded";

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
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const squadId = typeof body.squadId === "string" && body.squadId ? body.squadId : null;
  const problemSlug = typeof body.problemSlug === "string" ? body.problemSlug : "";
  const problemTitle = typeof body.problemTitle === "string" ? body.problemTitle.slice(0, 200) : null;
  const approach = typeof body.approach === "string" ? body.approach.slice(0, 8000) : null;
  const firstQuestion = body.firstQuestion !== false;

  if (problemSlug && !/^[a-z0-9-]{1,80}$/.test(problemSlug)) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 400 });
  }

  try {
    const gate = await getAiGate(squadId);
    const result = await askInterviewSim({
      squadId,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
