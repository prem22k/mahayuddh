import { NextResponse } from "next/server";
import { extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { getAiGate } from "@/lib/ai/gate";
import { askExplainBack } from "@/lib/ai/bounded";

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
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const squadId = typeof body.squadId === "string" && body.squadId ? body.squadId : null;
  const problemSlug = typeof body.problemSlug === "string" ? body.problemSlug : "";
  const problemTitle = typeof body.problemTitle === "string" ? body.problemTitle.slice(0, 200) : null;
  const explanation = typeof body.explanation === "string" ? body.explanation.slice(0, 8000) : "";

  if (problemSlug && !/^[a-z0-9-]{1,80}$/.test(problemSlug)) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 400 });
  }

  try {
    const gate = await getAiGate(squadId);
    const result = await askExplainBack({
      squadId,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
