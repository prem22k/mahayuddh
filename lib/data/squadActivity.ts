import { createClient } from "@/lib/supabase/client";
import { normalizeSlugList } from "@/lib/slug";
import { DataError } from "@/lib/data/errors";
import type { Difficulty } from "@/types/database";

/**
 * Squad activity derived from `problem_events` (public read) instead of
 * placeholder numbers.
 *
 * RLS facts this file relies on (see supabase/migrations):
 * - `battles`: own-row only. Only the caller's rows are readable.
 * - `problem_events`: PUBLIC read. Columns user_id, problem_slug, kind,
 *   battle_id, duration_sec, metadata jsonb (metadata->>'source' is
 *   'leetcode' or 'self'), created_at.
 * - `squad_members`, `squads`, `squad_goals`: public read.
 * - `suggestions` (challenges): public read for select, party-scoped writes.
 *
 * Every function throws DataError on query failure so callers can render an
 * honest retry state. Nothing here invents numbers.
 */

export interface SquadActivityMember {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface TodaySlugTime {
  bestSec: number | null;
  verified: boolean;
}

export interface SquadStreak {
  days: number;
  /** First day of the streak, local YYYY-MM-DD. */
  since: string;
}

export interface OwnFailedAttempt {
  durationSec: number | null;
  when: string | null;
}

export interface IncomingChallenge {
  id: string;
  fromName: string;
  fromAvatar: string | null;
  problemTitle: string;
  problemSlug: string;
  difficulty: Difficulty;
  beatSec: number | null;
  dueAt: string | null;
  note: string | null;
}

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function activityError(cause?: unknown): DataError {
  return new DataError(
    "squad-activity",
    "Couldn't load squad activity. Check your connection and retry.",
    { cause }
  );
}

/** Squad display name (public read). Null when the squad is gone. */
export async function getSquadName(squadId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squads")
    .select("name")
    .eq("id", squadId)
    .maybeSingle();
  if (error) throw activityError(error);
  return (data as unknown as { name: string } | null)?.name ?? null;
}

/** Squad members with public profile fields (both tables are public-read). */
export async function getSquadMembers(squadId: string): Promise<SquadActivityMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_members")
    .select("user_id, profile:user_id (id, username, avatar_url)")
    .eq("squad_id", squadId)
    .order("joined_at", { ascending: true });
  if (error) throw activityError(error);
  const rows = (data ?? []) as unknown as {
    user_id: string;
    profile: { id: string; username: string; avatar_url: string | null } | null;
  }[];
  return rows.map((r) => ({
    id: r.user_id,
    username: r.profile?.username ?? "member",
    avatar_url: r.profile?.avatar_url ?? null,
  }));
}

/**
 * Per-member best solve time for one slug, measured today (local day).
 * Considers kind in ('solved','revisited'). `verified` is true when any of
 * the member's events today carries metadata source 'leetcode'.
 */
export async function getTodaySlugTimes(
  slug: string,
  memberIds: string[]
): Promise<Record<string, TodaySlugTime>> {
  const out: Record<string, TodaySlugTime> = {};
  for (const id of memberIds) out[id] = { bestSec: null, verified: false };
  if (memberIds.length === 0) return out;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problem_events")
    .select("user_id, duration_sec, metadata")
    .in("user_id", memberIds)
    .eq("problem_slug", slug.toLowerCase())
    .in("kind", ["solved", "revisited"])
    .gte("created_at", startOfTodayLocal().toISOString());
  if (error) throw activityError(error);
  const rows = (data ?? []) as unknown as {
    user_id: string;
    duration_sec: number | null;
    metadata: { source?: unknown } | null;
  }[];
  for (const row of rows) {
    const entry = out[row.user_id];
    if (!entry) continue;
    if (typeof row.duration_sec === "number" && row.duration_sec >= 0) {
      if (entry.bestSec == null || row.duration_sec < entry.bestSec) {
        entry.bestSec = row.duration_sec;
      }
    }
    if (row.metadata && row.metadata.source === "leetcode") {
      entry.verified = true;
    }
  }
  return out;
}

/** Member ids with a solve event for the slug today (local day). */
export async function getSolvedToday(slug: string, memberIds: string[]): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problem_events")
    .select("user_id")
    .in("user_id", memberIds)
    .eq("problem_slug", slug.toLowerCase())
    .eq("kind", "solved")
    .gte("created_at", startOfTodayLocal().toISOString());
  if (error) throw activityError(error);
  const rows = (data ?? []) as unknown as { user_id: string }[];
  return new Set(rows.map((r) => r.user_id));
}

async function fetchSolveDays(
  memberIds: string[],
  sinceISO: string
): Promise<Map<string, Set<string>>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problem_events")
    .select("user_id, created_at")
    .in("user_id", memberIds)
    .in("kind", ["solved", "revisited"])
    .gte("created_at", sinceISO)
    .limit(5000);
  if (error) throw activityError(error);
  const rows = (data ?? []) as unknown as { user_id: string; created_at: string }[];
  const byDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = toLocalDayKey(new Date(row.created_at));
    let set = byDay.get(key);
    if (!set) {
      set = new Set<string>();
      byDay.set(key, set);
    }
    set.add(row.user_id);
  }
  return byDay;
}

/**
 * Consecutive days where EVERY member logged >=1 solve/revisited event.
 * Today counts only when all members solved today; otherwise the walk starts
 * from yesterday. Walk capped at 365 days.
 */
export async function getSquadStreak(memberIds: string[]): Promise<SquadStreak> {
  const today = startOfTodayLocal();
  if (memberIds.length === 0) return { days: 0, since: toLocalDayKey(today) };
  const floor = new Date(today);
  floor.setDate(floor.getDate() - 364);
  const byDay = await fetchSolveDays(memberIds, floor.toISOString());
  const hasAll = (d: Date): boolean => {
    const set = byDay.get(toLocalDayKey(d));
    if (!set) return false;
    return memberIds.every((id) => set.has(id));
  };
  const cursor = new Date(today);
  // Today counts only if ALL solved; else the streak is measured through yesterday.
  if (!hasAll(cursor)) cursor.setDate(cursor.getDate() - 1);
  let days = 0;
  while (days < 365 && hasAll(cursor)) {
    days += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  if (days === 0) return { days: 0, since: toLocalDayKey(today) };
  cursor.setDate(cursor.getDate() + 1);
  return { days, since: toLocalDayKey(cursor) };
}

/**
 * Per-member solve grid for the last `days` days, oldest -> newest.
 * True when the member logged >=1 solve/revisited event that local day.
 */
export async function getMemberWeekGrid(
  memberIds: string[],
  days = 7
): Promise<Record<string, boolean[]>> {
  const out: Record<string, boolean[]> = {};
  for (const id of memberIds) out[id] = Array<boolean>(days).fill(false);
  if (memberIds.length === 0 || days <= 0) return out;
  const today = startOfTodayLocal();
  const floor = new Date(today);
  floor.setDate(floor.getDate() - (days - 1));
  const byDay = await fetchSolveDays(memberIds, floor.toISOString());
  const indexByDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(floor);
    d.setDate(d.getDate() + i);
    indexByDay.set(toLocalDayKey(d), i);
  }
  for (const [dayKey, solvers] of byDay) {
    const idx = indexByDay.get(dayKey);
    if (idx == null) continue;
    for (const userId of solvers) {
      const row = out[userId];
      if (row) row[idx] = true;
    }
  }
  return out;
}

/**
 * The caller's most recent failed attempt on a slug: duration + when.
 * Own battles are readable (own-row RLS); falls back to the caller's own
 * kind='failed' problem_events rows. Null when there is no failed attempt.
 */
export async function getOwnFailedAttempt(slug: string): Promise<OwnFailedAttempt | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const lowered = slug.toLowerCase();
  const { data: battles, error: bErr } = await supabase
    .from("battles")
    .select("duration_sec, started_at, ended_at")
    .eq("user_id", user.id)
    .eq("problem_slug", lowered)
    .eq("outcome", "failed")
    .order("started_at", { ascending: false })
    .limit(1);
  if (bErr) throw activityError(bErr);
  const battle = (battles ?? [])[0] as unknown as
    | { duration_sec: number | null; started_at: string; ended_at: string | null }
    | undefined;
  if (battle) {
    return {
      durationSec: battle.duration_sec ?? null,
      when: battle.ended_at ?? battle.started_at ?? null,
    };
  }
  const { data: events, error: eErr } = await supabase
    .from("problem_events")
    .select("duration_sec, created_at")
    .eq("user_id", user.id)
    .eq("problem_slug", lowered)
    .eq("kind", "failed")
    .order("created_at", { ascending: false })
    .limit(1);
  if (eErr) throw activityError(eErr);
  const event = (events ?? [])[0] as unknown as
    | { duration_sec: number | null; created_at: string }
    | undefined;
  if (!event) return null;
  return { durationSec: event.duration_sec ?? null, when: event.created_at ?? null };
}

/**
 * Oldest open challenge addressed to the user (table: `suggestions`,
 * status 'pending', ordered by created_at ascending). Read-only.
 */
export async function getFirstIncomingChallenge(
  userId: string
): Promise<IncomingChallenge | null> {
  if (!userId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .select(
      "id, problem_slug, problem_title, difficulty, sender_time_sec, deadline_at, message, note, created_at, from_profile:from_user (id, username, avatar_url)"
    )
    .eq("to_user", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw activityError(error);
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    problem_slug: string;
    problem_title: string;
    difficulty: Difficulty;
    sender_time_sec: number | null;
    deadline_at: string | null;
    message: string | null;
    note: string | null;
    from_profile: { id: string; username: string; avatar_url: string | null } | null;
  };
  return {
    id: row.id,
    fromName: row.from_profile?.username ?? "Someone",
    fromAvatar: row.from_profile?.avatar_url ?? null,
    problemTitle: row.problem_title,
    problemSlug: row.problem_slug,
    difficulty: row.difficulty,
    beatSec: row.sender_time_sec ?? null,
    dueAt: row.deadline_at ?? null,
    note: row.message ?? row.note ?? null,
  };
}

/**
 * Verified solvers per slug (sheet honest-data boundary).
 *
 * A member "verified" a slug when problem_events holds a solve/revisited row
 * for them with metadata->>'source' = 'leetcode'. Anything marked solved in
 * user_problem_status without such a row is self-reported. problem_events is
 * PUBLIC read, so this only splits what callers already see into proven vs
 * claimed — it leaks nothing.
 *
 * Returns a map of lowercased slug -> set of member ids with a verified
 * solve/revisit event. Empty in, empty out.
 */
export async function getVerifiedSolvers(
  slugs: string[],
  memberIds: string[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const uniqueSlugs = normalizeSlugList(slugs, 5000);
  const uniqueMembers = Array.from(new Set((memberIds ?? []).filter(Boolean)));
  if (uniqueSlugs.length === 0 || uniqueMembers.length === 0) return out;

  const supabase = createClient();
  const IN_CHUNK = 200;
  for (let i = 0; i < uniqueSlugs.length; i += IN_CHUNK) {
    const slice = uniqueSlugs.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("problem_events")
      .select("user_id, problem_slug")
      .in("user_id", uniqueMembers)
      .in("problem_slug", slice)
      .in("kind", ["solved", "revisited"])
      .filter("metadata->>source", "eq", "leetcode");
    if (error) throw activityError(error);
    if (!data) throw activityError();
    for (const row of data as unknown as { user_id: string; problem_slug: string }[]) {
      const key = (row.problem_slug ?? "").toLowerCase();
      if (!key) continue;
      let set = out.get(key);
      if (!set) {
        set = new Set<string>();
        out.set(key, set);
      }
      set.add(row.user_id);
    }
  }
  return out;
}
