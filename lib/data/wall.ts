import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import type { SquadMilestone } from "@/types/database";

/**
 * The squad wall (Step 20).
 *
 * Capped in the query rather than by deleting rows: history is not pruned
 * (§64), the list is just bounded so it stays readable.
 */
export async function getWall(
  squadId: string,
  limit = 50
): Promise<{ milestones: SquadMilestone[]; name: string }> {
  const supabase = createClient();

  const [milestonesRes, squadRes] = await Promise.all([
    supabase
      .from("squad_milestones")
      .select("id, squad_id, kind, title, detail, occurred_at")
      .eq("squad_id", squadId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    supabase.from("squads").select("name").eq("id", squadId).maybeSingle(),
  ]);

  if (milestonesRes.error) {
    throw new DataError("wall", "Couldn't load the wall. Retry.", { cause: milestonesRes.error });
  }
  if (squadRes.error) {
    throw new DataError("wall", "Couldn't load this squad. Retry.", { cause: squadRes.error });
  }

  return {
    milestones: (milestonesRes.data ?? []) as SquadMilestone[],
    name: (squadRes.data as { name: string } | null)?.name ?? "Squad",
  };
}
