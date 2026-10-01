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
  const { data: squads, error: sErr } = await supabase.from("squads").select("*").in("id", ids);
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
      supabase.from("squads").select("*").eq("id", squadId).maybeSingle(),
      supabase
        .from("squad_members")
        .select("*, profile:user_id (id, username, leetcode_username, avatar_url, streak, total_easy, total_medium, total_hard, contest_rating)")
        .eq("squad_id", squadId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("squad_goals")
        .select("*")
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
    members: (members ?? []) as SquadMember[],
    goals: (goals ?? []) as SquadGoal[],
  };
}

/** All-time solved count per member (v0 goal progress; honest label, no date gaming). */
export async function getSquadSolveCounts(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_problem_status")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "solved");
  if (error || !data) return {};
  const counts: Record<string, number> = {};
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

export async function joinSquad(inviteCode: string): Promise<Squad> {
  const token = await accessToken();
  const res = await fetch("/api/squads/join", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify({ invite_code: inviteCode.trim().toUpperCase() }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError("squads", json.error || "Couldn't join squad. Check the code and try again.");
  return json.squad as Squad;
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
