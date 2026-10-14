import { createClient } from "@/lib/supabase/client";
import { ProblemEvent, ProblemEventKind } from "@/types/database";
import { DataError } from "@/lib/data/errors";

/** Explicit projection: every problem_events column, per schema. */
const EVENT_COLUMNS = "id,user_id,problem_slug,kind,battle_id,duration_sec,metadata,created_at";

/** Append a history event (timelines are append-only; never update/delete). */
export async function logProblemEvent(params: {
  problemSlug: string;
  kind: ProblemEventKind;
  battleId?: string | null;
  durationSec?: number | null;
  source?: "leetcode" | "self";
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("problem_events").insert({
    user_id: user.id,
    problem_slug: params.problemSlug.toLowerCase(),
    kind: params.kind,
    battle_id: params.battleId ?? null,
    duration_sec: params.durationSec ?? null,
    metadata: { source: params.source ?? "self" },
  });
  if (!error) return;
  // 23505 on (battle_id, kind) means the battle-end trigger already wrote this
  // exact event, which is the normal case now rather than a failure: the trigger
  // owns battle-derived history so a dropped client write cannot lose a solve.
  // Warn on anything else, because that is still a lost event.
  if (error.code === "23505" && params.battleId) return;
  console.warn("logProblemEvent failed:", error.message);
}

export async function getProblemTimeline(
  problemSlug: string,
  userId?: string | null,
  limit = 100
): Promise<ProblemEvent[]> {
  const supabase = createClient();
  let query = supabase
    .from("problem_events")
    .select(EVENT_COLUMNS)
    .eq("problem_slug", problemSlug.toLowerCase())
    .order("created_at", { ascending: true })
    .limit(limit);
  // Own full history + squad/public activity; strangers see only non-private?
  // v0: events carry no private content (kind + duration only), so scope by user when asked.
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw new DataError("history", "Couldn't load problem history. Retry.", { cause: error });
  if (!data) throw new DataError("history", "Couldn't load problem history. Retry.");
  return data as ProblemEvent[];
}

/** Caller's own history for a slug, newest first (matrix hover preview). */
export async function getOwnProblemTimeline(
  problemSlug: string,
  limit = 5
): Promise<ProblemEvent[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("problem_events")
    .select(EVENT_COLUMNS)
    .eq("problem_slug", problemSlug.toLowerCase())
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new DataError("history", "Couldn't load problem history. Retry.", { cause: error });
  return (data ?? []) as ProblemEvent[];
}
