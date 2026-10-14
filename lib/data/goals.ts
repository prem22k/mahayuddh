import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import { daysBetween } from "@/lib/format";
import type { SquadGoal, SquadSeason, ProblemEvent, SquadMember } from "@/types/database";

/**
 * Squad goals and seasons (Step 19, Bible §28–§30).
 *
 * The important change from the v0 goal bar: progress counts *solves inside the
 * goal's window*, filtered by its pattern when it has one. The old version
 * summed every solve a member has ever made, so a goal could show 40/50 before
 * anybody did anything this week — a number that cannot go down and so cannot
 * mean anything.
 */

export interface GoalProgress {
  goal: SquadGoal;
  /** Solves by members inside the window, pattern-filtered when set. */
  done: number;
  target: number;
  pct: number;
  participants: number;
  memberCount: number;
  daysRemaining: number | null;
  remaining: number;
  /** "3 solves away from this goal" — the nudge, without a notification. */
  nudge: string | null;
}

/** Problems carrying a topic, for pattern-filtered goal progress. */
async function problemSlugsForPattern(pattern: string): Promise<Set<string> | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problems")
    .select("title_slug, topics")
    .contains("topics", [pattern]);
  if (error) {
    throw new DataError("goals", "Couldn't match that pattern. Retry.", { cause: error });
  }
  if (!data) throw new DataError("goals", "Couldn't match that pattern. Retry.");
  return new Set((data as { title_slug: string }[]).map((p) => p.title_slug));
}

/**
 * Count a goal's progress from problem_events — append-only history, so this is
 * a real timeline and not a mutable tally.
 */
export async function computeGoalProgress(
  goal: SquadGoal,
  members: SquadMember[],
  now: Date = new Date()
): Promise<GoalProgress> {
  const supabase = createClient();
  const memberIds = members.map((m) => m.user_id);
  const target = Math.max(goal.target_count, 1);

  if (memberIds.length === 0) {
    return {
      goal,
      done: 0,
      target,
      pct: 0,
      participants: 0,
      memberCount: 0,
      daysRemaining: goal.deadline ? Math.max(0, daysBetween(now, new Date(goal.deadline))) : null,
      remaining: target,
      nudge: null,
    };
  }

  const since = goal.starts_at ?? (goal.created_at ? goal.created_at.slice(0, 10) : null);

  let query = supabase
    .from("problem_events")
    .select("user_id, problem_slug, kind, created_at")
    .in("user_id", memberIds)
    .in("kind", ["solved", "revisited"])
    .order("created_at", { ascending: false })
    .limit(2000);

  if (since) query = query.gte("created_at", `${since}T00:00:00.000Z`);

  const { data, error } = await query;
  if (error) {
    throw new DataError("goals", "Couldn't compute goal progress. Retry.", { cause: error });
  }
  if (!data) throw new DataError("goals", "Couldn't compute goal progress. Retry.");

  let events = data as ProblemEvent[];

  // A pattern-scoped goal only counts problems carrying that topic.
  if (goal.pattern) {
    const slugs = await problemSlugsForPattern(goal.pattern);
    if (slugs) events = events.filter((e) => slugs.has(e.problem_slug));
  }

  const contributors = new Set(events.map((e) => e.user_id));
  const done = events.length;
  const remaining = Math.max(0, target - done);

  return {
    goal,
    done,
    target,
    pct: Math.min(100, Math.round((done / target) * 100)),
    participants: contributors.size,
    memberCount: memberIds.length,
    daysRemaining: goal.deadline ? Math.max(0, daysBetween(now, new Date(goal.deadline))) : null,
    remaining,
    // Honest nudge: only when it is close, and never when it is already met.
    nudge:
      remaining === 0
        ? null
        : remaining <= 5
          ? `${remaining} ${remaining === 1 ? "solve" : "solves"} away from this goal.`
          : null,
  };
}

export async function getActiveGoals(squadId: string): Promise<SquadGoal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_goals")
    .select("*")
    .eq("squad_id", squadId)
    .eq("status", "active")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) {
    throw new DataError("goals", "Couldn't load squad goals. Retry.", { cause: error });
  }
  return (data ?? []) as SquadGoal[];
}

export async function archiveGoal(goalId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("squad_goals").update({ archived: true }).eq("id", goalId);
  if (error) {
    throw new DataError("goals", "Couldn't archive that goal. Try again.", { cause: error });
  }
}

// ── Seasons ─────────────────────────────────────────────────────────────────

export async function getSeasons(squadId: string): Promise<SquadSeason[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_seasons")
    .select("*")
    .eq("squad_id", squadId)
    .order("starts_at", { ascending: false })
    .limit(20);
  if (error) {
    throw new DataError("seasons", "Couldn't load seasons. Retry.", { cause: error });
  }
  return (data ?? []) as SquadSeason[];
}

export async function createSeason(params: {
  squadId: string;
  name: string;
  objective?: string | null;
  objectiveTarget?: number | null;
  objectivePattern?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<SquadSeason> {
  const supabase = createClient();
  const name = params.name.trim().slice(0, 80);
  if (!name) throw new DataError("seasons", "Give the season a name.");

  const target =
    params.objectiveTarget != null && Number.isFinite(params.objectiveTarget)
      ? Math.min(Math.max(Math.trunc(params.objectiveTarget), 1), 100000)
      : null;
  const pattern = params.objectivePattern?.trim().slice(0, 80) || null;

  const { data, error } = await supabase
    .from("squad_seasons")
    .insert({
      squad_id: params.squadId,
      name,
      objective: params.objective?.trim().slice(0, 500) || null,
      // Measured-objective columns are only sent when set, so seasons can
      // still be created on a database that predates the migration.
      ...(target != null ? { objective_target: target } : {}),
      ...(pattern ? { objective_pattern: pattern } : {}),
      starts_at: params.startsAt || new Date().toISOString().slice(0, 10),
      ends_at: params.endsAt || null,
      status: "active",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new DataError("seasons", "You already have an active season. Finish it first.");
    }
    throw new DataError("seasons", "Couldn't start that season. Try again.", { cause: error });
  }
  if (!data) throw new DataError("seasons", "Couldn't start that season. Try again.");
  return data as SquadSeason;
}

export async function completeSeason(seasonId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("squad_seasons")
    .update({ status: "complete" })
    .eq("id", seasonId);
  if (error) {
    throw new DataError("seasons", "Couldn't finish that season. Try again.", { cause: error });
  }
}

/**
 * Season metrics. Plain counts over existing rows — no scoring formula, no
 * unlocks (§61 kills the XP economy).
 */
export interface SeasonMetrics {
  solves: number;
  challengesSent: number;
  challengesCompleted: number;
  approachesWritten: number;
  activeMembers: number;
}

export async function computeSeasonMetrics(
  season: SquadSeason,
  memberIds: string[],
  now: Date = new Date()
): Promise<SeasonMetrics> {
  const supabase = createClient();
  const empty: SeasonMetrics = {
    solves: 0,
    challengesSent: 0,
    challengesCompleted: 0,
    approachesWritten: 0,
    activeMembers: 0,
  };
  if (memberIds.length === 0) return empty;

  const from = `${season.starts_at}T00:00:00.000Z`;

  const [solves, sent, completed, approaches] = await Promise.all([
    supabase
      .from("problem_events")
      .select("user_id", { count: "exact", head: true })
      .in("user_id", memberIds)
      .in("kind", ["solved", "revisited"])
      .gte("created_at", from),
    supabase
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .in("from_user", memberIds)
      .gte("created_at", from),
    supabase
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .in("to_user", memberIds)
      .eq("status", "completed")
      .gte("completed_at", from),
    supabase
      .from("approaches")
      .select("id", { count: "exact", head: true })
      .in("user_id", memberIds)
      .gte("created_at", from),
  ]);

  // "Active" means they touched something this season — a list, not a score.
  const { data: active } = await supabase
    .from("problem_events")
    .select("user_id")
    .in("user_id", memberIds)
    .gte("created_at", from)
    .limit(1000);
  const activeIds = new Set(
    ((active ?? []) as { user_id: string }[]).map((e) => e.user_id)
  );

  void now;
  return {
    solves: solves.count ?? 0,
    challengesSent: sent.count ?? 0,
    challengesCompleted: completed.count ?? 0,
    approachesWritten: approaches.count ?? 0,
    activeMembers: activeIds.size,
  };
}