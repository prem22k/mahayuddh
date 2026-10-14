import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import { buildRevengeResult, RevengeResult } from "@/lib/revenge";
import { getActiveSquadId } from "@/lib/data/squads";
import type { Battle } from "@/types/database";

/**
 * Supabase access for revenge. Kept apart from lib/revenge.ts so the derivation
 * stays pure and testable outside Next — the same split as lib/statusMap.ts.
 */

/**
 * Own sessions for the caller's open revenge problems, newest first.
 * Uses the review_queue rows already materialized by the battle-end trigger.
 */
export async function getOpenRevenges(slugs: string[]): Promise<Map<string, Battle[]>> {
  const out = new Map<string, Battle[]>();
  if (slugs.length === 0) return out;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return out;

  const { data, error } = await supabase
    .from("battles")
    .select("*")
    .eq("user_id", user.id)
    .in("problem_slug", slugs.map((s) => s.toLowerCase()))
    .order("started_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new DataError("revenge", "Couldn't load your revenge queue. Retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("revenge", "Couldn't load your revenge queue. Retry.");
  }

  for (const battle of data as Battle[]) {
    const list = out.get(battle.problem_slug) ?? [];
    list.push(battle);
    out.set(battle.problem_slug, list);
  }
  return out;
}

/**
 * Detect the revenge completion for a just-finished solve.
 * Returns null when the solve did not answer a recorded failure.
 */
export async function detectRevengeCompletion(
  problemSlug: string,
  solvedBattleId: string,
  title?: string | null
): Promise<RevengeResult | null> {
  const slug = problemSlug.toLowerCase();
  const battles = await getOpenRevenges([slug]);
  const rows = battles.get(slug) ?? [];
  const solved = rows.find((b) => b.id === solvedBattleId);
  if (!solved || solved.outcome !== "solved") return null;

  const result = buildRevengeResult(slug, solved, rows, title);
  if (!result) return null;

  // Squad activity: the improvement is the story worth sharing (§50).
  try {
    const { logFeedEvent } = await import("@/lib/data/feed");
    const supabase = createClient();
    const { data: session } = await supabase.auth.getUser();
    const squadId = session?.user
      ? await getActiveSquadId(session.user.id)
      : null;
    if (squadId) {
      await logFeedEvent({
        eventType: "improve",
        squadId,
        problemTitle: result.title,
        problemSlug: slug,
        objectType: "revenge",
        objectId: solvedBattleId,
        metadata: {
          previous_failed_sec: result.previousFailedSec,
          solved_sec: result.solvedSec,
          improved: result.improved,
        },
      });
    }
  } catch {
    // Feed is best-effort; the revenge itself already happened.
  }

  return result;
}
