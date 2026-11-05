import { createClient } from "@/lib/supabase/client";
import { Battle, BattleOutcome } from "@/types/database";

/** Explicit projection: every Battle column, no `*` (keeps every field callers use). */
const BATTLE_COLUMNS =
  "id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,scratchpad_md,confidence,created_at";

async function token(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function post(body: Record<string, unknown>): Promise<{ battle?: Battle; error?: string; expired?: boolean }> {
  const t = await token();
  const res = await fetch("/api/battles", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (json as { error?: string }).error || "Battle sync failed.", expired: (json as { expired?: boolean }).expired === true || res.status === 410 };
  return { battle: (json as { battle?: Battle }).battle as Battle | undefined };
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
    .select(BATTLE_COLUMNS)
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
    .select(BATTLE_COLUMNS)
    .eq("problem_slug", problemSlug.toLowerCase())
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Battle[];
}

export interface SolvedQuestion {
  slug: string;
  title: string;
  accepted_at: number;
  difficulty?: string;
}

export interface BattleVerificationResult {
  linked: boolean;
  verified?: boolean;
  username?: string;
  reachable?: boolean;
  started_at?: string;
  target?: SolvedQuestion | null;
  solved?: SolvedQuestion[];
  error?: string;
  retry_after?: number;
  status?: number;
}

export async function verifyBattle(battleId: string): Promise<BattleVerificationResult> {
  const t = await token();
  const res = await fetch("/api/battles/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ battle_id: battleId }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    linked: json.linked === true,
    verified: typeof json.verified === "boolean" ? json.verified : undefined,
    username: typeof json.username === "string" ? json.username : undefined,
    reachable: typeof json.reachable === "boolean" ? json.reachable : undefined,
    started_at: typeof json.started_at === "string" ? json.started_at : undefined,
    target: (json.target as SolvedQuestion | null) ?? null,
    solved: Array.isArray(json.solved) ? (json.solved as SolvedQuestion[]) : [],
    error: typeof json.error === "string" ? json.error : undefined,
    retry_after: typeof json.retry_after === "number" ? json.retry_after : undefined,
    status: res.status,
  };
}
