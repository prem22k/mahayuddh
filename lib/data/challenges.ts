import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import type { Suggestion } from "@/types/database";

/**
 * Challenges that belong to a squad — the rows where at least one party is a
 * member. Used for the "longest live chain" highlight (Step 17).
 *
 * Kept separate from getSuggestions() because that one is caller-scoped
 * (everything involving you) and unbounded; this one is squad-scoped and
 * capped, since it feeds a single summary card rather than a list.
 */
export async function getSquadChallengeRows(
  squadId: string,
  limit = 200
): Promise<Suggestion[]> {
  const supabase = createClient();

  const { data: members, error: mErr } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squadId);
  if (mErr) {
    throw new DataError("challenges", "Couldn't load squad challenges. Retry.", { cause: mErr });
  }

  const ids = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("suggestions")
    .select(
      "id,from_user,to_user,problem_slug,problem_title,difficulty,status,sender_time_sec,beat_time,deadline_at,parent_id,spoiler,created_at,completed_at,accepted_at,reminded_at"
    )
    .in("from_user", ids)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataError("challenges", "Couldn't load squad challenges. Retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("challenges", "Couldn't load squad challenges. Retry.");
  }

  // Also include challenges *sent to* a member by somebody outside the squad:
  // those still count as squad activity once accepted.
  const { data: inbound } = await supabase
    .from("suggestions")
    .select(
      "id,from_user,to_user,problem_slug,problem_title,difficulty,status,sender_time_sec,beat_time,deadline_at,parent_id,spoiler,created_at,completed_at,accepted_at,reminded_at"
    )
    .in("to_user", ids)
    .order("created_at", { ascending: false })
    .limit(limit);

  const merged = new Map<string, Suggestion>();
  for (const row of [...(data ?? []), ...(inbound ?? [])] as Suggestion[]) {
    merged.set(row.id, row);
  }
  return Array.from(merged.values());
}