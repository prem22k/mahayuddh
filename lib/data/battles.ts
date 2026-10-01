import { createClient } from "@/lib/supabase/client";
import { Battle, BattleOutcome } from "@/types/database";

async function token(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function post(body: Record<string, unknown>): Promise<{ battle?: Battle; error?: string }> {
  const t = await token();
  const res = await fetch("/api/battles", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json.error || "Battle sync failed." };
  return { battle: json.battle as Battle };
}

export async function startBattle(
  problemSlug: string,
  squadId?: string | null,
  challengeId?: string | null
) {
  return post({
    action: "start",
    problem_slug: problemSlug,
    squad_id: squadId ?? undefined,
    challenge_id: challengeId ?? undefined,
  });
}

/** Live session for the caller, if any (used to resume after a refresh). */
export async function getInProgressBattle(): Promise<Battle | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("battles")
    .select("*")
    .eq("outcome", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Battle | null) ?? null;
}

export async function heartbeatBattle(battleId: string, patch: { scratchpad_md?: string; duration_sec?: number }) {
  return post({ action: "heartbeat", battle_id: battleId, ...patch });
}

export async function endBattle(
  battleId: string,
  outcome: Exclude<BattleOutcome, "in_progress">,
  patch?: { duration_sec?: number; scratchpad_md?: string; confidence?: number; evidence?: "leetcode" | "none" }
) {
  return post({ action: "end", battle_id: battleId, outcome, ...patch });
}

/** Latest finished battle for a slug (prefills "beat my time" + timeline context). */
export async function getLatestBattle(problemSlug: string): Promise<Battle | null> {
  const all = await getBattlesForSlug(problemSlug, 1);
  return all[0] ?? null;
}

/** Own sessions for a slug, newest first (problem page "Your attempts"). */
export async function getBattlesForSlug(problemSlug: string, limit = 10): Promise<Battle[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("battles")
    .select("*")
    .eq("problem_slug", problemSlug.toLowerCase())
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Battle[];
}
