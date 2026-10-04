import { NextResponse } from "next/server";
import { extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { getAiGate } from "@/lib/ai/gate";
import { askExplainMistake } from "@/lib/ai/bounded";

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
 * this route, and it is bounded below.
 */
export async function POST(request: Request) {
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const squadId = typeof body.squadId === "string" && body.squadId ? body.squadId : null;
  const problemSlug = typeof body.problemSlug === "string" ? body.problemSlug : "";
  const problemTitle = typeof body.problemTitle === "string" ? body.problemTitle.slice(0, 200) : null;
  const scratchpad = typeof body.scratchpad === "string" ? body.scratchpad.slice(0, 20000) : "";

  if (problemSlug && !/^[a-z0-9-]{1,80}$/.test(problemSlug)) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 400 });
  }

  try {
    const gate = await getAiGate(squadId);
    const result = await askExplainMistake({
      squadId,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
