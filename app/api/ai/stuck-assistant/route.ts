import { NextResponse } from "next/server";
import { extractBearerToken, resolveUser } from "@/lib/supabase/service";
import { askStuckAssistant, getAiGate } from "@/lib/ai/gate";
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
 */
const LEVELS: StuckLevel[] = ["nudge", "pattern", "direction", "full"];

export async function POST(request: Request) {
  const user = await resolveUser(extractBearerToken(request));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
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
    const gate = await getAiGate(squadId);
    const result = await askStuckAssistant({
      squadId,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
