import { createClient } from "@/lib/supabase/client";
import { Squad, SquadMember, SquadGoal } from "@/types/database";
import { DataError } from "@/lib/data/errors";

function authedHeaders(token?: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function accessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface MySquads {
  squads: Squad[];
  activeSquadId: string | null;
}

/** Explicit projections (no `*`): every column callers use, per schema. */
const SQUAD_COLUMNS = "id,name,avatar_url,description,created_by,invite_code,shared_goal_text,season_name,created_at";
const SQUAD_MEMBER_COLUMNS =
  "squad_id,user_id,role,active,joined_at,last_active_at,profile:user_id (id, username, leetcode_username, avatar_url, streak, total_easy, total_medium, total_hard, contest_rating)";
const SQUAD_GOAL_COLUMNS =
  "id,squad_id,title,target_count,pattern,deadline,status,created_by,created_at,starts_at,archived";

export async function getMySquads(userId: string, activeSquadId?: string | null): Promise<MySquads> {
  const supabase = createClient();
  const { data: memberships, error: mErr } = await supabase
    .from("squad_members")
    .select("squad_id, role, joined_at")
    .eq("user_id", userId);
  if (mErr) {
    throw new DataError("squads", "Couldn't load your squads. Check your connection and retry.", { cause: mErr });
  }
  if (!memberships || memberships.length === 0) return { squads: [], activeSquadId: activeSquadId ?? null };
  const ids = memberships.map((m) => m.squad_id);
  const { data: squads, error: sErr } = await supabase.from("squads").select(SQUAD_COLUMNS).in("id", ids);
  if (sErr) {
    throw new DataError("squads", "Couldn't load your squads. Check your connection and retry.", { cause: sErr });
  }
  return { squads: (squads ?? []) as Squad[], activeSquadId: activeSquadId ?? null };
}

export async function getSquadDetail(squadId: string): Promise<{
  squad: Squad;
  members: SquadMember[];
  goals: SquadGoal[];
}> {
  const supabase = createClient();
  const [{ data: squad, error: sErr }, { data: members, error: mErr }, { data: goals, error: gErr }] =
    await Promise.all([
      supabase.from("squads").select(SQUAD_COLUMNS).eq("id", squadId).maybeSingle(),
      supabase
        .from("squad_members")
        .select(SQUAD_MEMBER_COLUMNS)
        .eq("squad_id", squadId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("squad_goals")
        .select(SQUAD_GOAL_COLUMNS)
        .eq("squad_id", squadId)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);
  if (sErr || !squad) {
    throw new DataError("squads", "Couldn't load this squad. Check your connection and retry.", { cause: sErr });
  }
  if (mErr) throw new DataError("squads", "Couldn't load squad members. Retry.", { cause: mErr });
  if (gErr) throw new DataError("squads", "Couldn't load squad goals. Retry.", { cause: gErr });
  return {
    squad: squad as Squad,
    members: (members ?? []) as unknown as SquadMember[],
    goals: (goals ?? []) as SquadGoal[],
  };
}

/** Solves per member in the last 7 days (same window pattern as getSolvesWindow). */
export async function getSquadSolveCounts(userIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of userIds) counts[id] = 0;
  if (userIds.length === 0) return counts;
  const supabase = createClient();
  const sinceISO = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("problem_events")
    .select("user_id")
    .in("user_id", userIds)
    .eq("kind", "solved")
    .gte("created_at", sinceISO);
  if (error || !data) return counts;
  for (const row of data as { user_id: string }[]) {
    counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
  }
  return counts;
}

export async function createSquad(params: { name: string; description?: string }): Promise<Squad> {
  const token = await accessToken();
  const res = await fetch("/api/squads", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError("squads", json.error || "Couldn't create squad. Try again.");
  return json.squad as Squad;
}

export async function joinSquad(
  inviteCode: string,
  /** Loop D referral token. Attributes the join; grants nothing. */
  referralToken?: string | null
): Promise<{ squad: Squad; invitedBy: string | null }> {
  const token = await accessToken();
  const res = await fetch("/api/squads/join", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify({
      invite_code: inviteCode.trim().toUpperCase(),
      ref: referralToken ?? undefined,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError("squads", json.error || "Couldn't join squad. Check the code and try again.");
  return {
    squad: json.squad as Squad,
    // Null when nobody referred them, which is most joins. Never invented.
    invitedBy: (json.invited_by as string | null) ?? null,
  };
}

export async function switchActiveSquad(squadId: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch("/api/squads/switch", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify({ squad_id: squadId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError("squads", json.error || "Couldn't switch squad. Try again.");
}

export async function leaveSquad(squadId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("squad_members")
    .delete()
    .eq("squad_id", squadId)
    .eq("user_id", userId);
  if (error) throw new DataError("squads", "Couldn't leave squad. Try again.", { cause: error });
}

export async function createSquadGoal(params: {
  squad_id: string;
  title: string;
  target_count: number;
  pattern?: string;
  deadline?: string;
}): Promise<SquadGoal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_goals")
    .insert({
      squad_id: params.squad_id,
      title: params.title.trim().slice(0, 120),
      target_count: Math.min(Math.max(Math.trunc(params.target_count) || 1, 1), 10000),
      pattern: params.pattern?.trim() || null,
      deadline: params.deadline || null,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new DataError("squads", "Couldn't create goal. Try again.", { cause: error });
  }
  return data as SquadGoal;
}

export async function completeSquadGoal(goalId: string, squadId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("squad_goals")
    .update({ status: "completed" })
    .eq("id", goalId)
    .eq("squad_id", squadId);
  if (error) throw new DataError("squads", "Couldn't complete goal. Try again.", { cause: error });
}

/** The caller's active squad id, or null when solo. */
export async function getActiveSquadId(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("active_squad_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new DataError("squads", "Couldn't load your squad. Retry.", { cause: error });
  }
  return (data as { active_squad_id: string | null } | null)?.active_squad_id ?? null;
}

/**
 * Members of the caller's ACTIVE squad, for pickers (challenge targets, mentions).
 * Empty when the caller is solo — the caller is not offered a global user
 * directory, because a challenge is a relationship, not a broadcast (§61).
 */
export async function getActiveSquadMembers(): Promise<
  { id: string; username: string }[]
> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("active_squad_id")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr) {
    throw new DataError("squads", "Couldn't load your squad. Retry.", { cause: pErr });
  }
  const squadId = (profile as { active_squad_id: string | null } | null)?.active_squad_id;
  if (!squadId) return [];

  const { data, error } = await supabase
    .from("squad_members")
    .select("user_id, profile:user_id (username)")
    .eq("squad_id", squadId)
    .neq("user_id", user.id);
  if (error) {
    throw new DataError("squads", "Couldn't load squad members. Retry.", { cause: error });
  }

  // Embedded `profile:user_id (...)` widens to an array under the generated
  // PostgREST types; the runtime shape is a single object.
  return ((data ?? []) as unknown as { user_id: string; profile: { username: string } | null }[]).map(
    (m) => ({ id: m.user_id, username: m.profile?.username ?? "member" })
  );
}

/** Active member ids of one squad (not all profiles). */
export async function getSquadMemberIds(squadId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squadId);
  if (error) {
    throw new DataError("squads", "Couldn't load squad members. Retry.", { cause: error });
  }
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
}

/** Active goal pattern for the Daily Battle "why" signal (null = no goal). */
export async function getActiveGoalPattern(squadId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("squad_goals")
    .select("pattern")
    .eq("squad_id", squadId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pattern = (data as { pattern: string | null } | null)?.pattern;
  return pattern ?? null;
}
export async function getSlugSquadActivity(
  slug: string,
  memberIds: string[]
): Promise<{ attempted: number; total: number }> {
  if (memberIds.length === 0) return { attempted: 0, total: 0 };
  const supabase = createClient();
  const { data } = await supabase
    .from("user_problem_status")
    .select("user_id")
    .eq("problem_slug", slug.toLowerCase())
    .in("user_id", memberIds);
  const unique = new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
  return { attempted: unique.size, total: memberIds.length };
}
