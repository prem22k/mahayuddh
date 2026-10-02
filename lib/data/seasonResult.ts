import { getServiceClient } from "@/lib/supabase/service";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Public season result (Step 20/§38).
 *
 * A season is a thing a squad finished together, which makes it the one artifact
 * whose whole point is the group rather than one person's solve. It was listed
 * in Step 20 and never built, so a completed season had nothing to share.
 *
 * Read-only and aggregate. Named members and counts, no scratchpads, no
 * approaches, no per-battle detail — the numbers are what the squad did
 * together, and anything finer would make this a dossier.
 */
export interface SeasonResult {
  seasonId: string;
  squadId: string;
  squadName: string;
  name: string;
  objective: string | null;
  startsAt: string;
  endsAt: string | null;
  status: "upcoming" | "active" | "complete";
  solves: number;
  challengesSent: number;
  challengesCompleted: number;
  approachesWritten: number;
  primersShared: number;
  activeDays: number;
  /** Distinct problems the squad touched. */
  problems: number;
  patterns: number;
  /** Per-member contribution. Names are public because the squad is public. */
  members: { username: string; solves: number }[];
  /** Best measured improvement in the window, or null when nothing qualifies. */
  bestImprovement: { username: string; slug: string; fromSec: number; toSec: number } | null;
  headline: string;
}

export async function getSeasonResult(
  squadId: string,
  seasonId: string
): Promise<SeasonResult | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data: season } = await supabase
    .from("squad_seasons")
    .select("id,squad_id,name,objective,starts_at,ends_at,status")
    .eq("id", seasonId)
    .eq("squad_id", squadId)
    .maybeSingle();
  if (!season) return null;

  const { data: squad } = await supabase
    .from("squads")
    .select("id,name")
    .eq("id", squadId)
    .maybeSingle();

  const memberIds = (
    await supabase.from("squad_members").select("user_id").eq("squad_id", squadId)
  ).data?.map((m) => ({ user_id: (m as { user_id: string }).user_id })) ?? [];

  const from = new Date(season.starts_at).toISOString();
  const to = season.ends_at
    ? new Date(new Date(season.ends_at).getTime() + 86_400_000).toISOString()
    : new Date().toISOString();

  const [solvesRes, approachesRes, primersRes, challengesRes, profilesRes] = await Promise.all([
    supabase
      .from("problem_events")
      .select("user_id,problem_slug,kind,duration_sec,created_at,metadata")
      .eq("kind", "solved")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("approaches")
      .select("id,user_id,problem_slug,created_at")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("primers")
      .select("id,author_id,pattern,created_at")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("suggestions")
      .select("from_user,to_user,status,created_at")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("profiles")
      .select("id,username")
      .in("id", memberIds.map((m) => m.user_id).concat(["00000000-0000-0000-0000-000000000000"])),
  ]);

  const memberSet = new Set(memberIds.map((m) => m.user_id));
  const inSquad = <T extends { user_id?: string; from_user?: string; author_id?: string }>(r: T) =>
    memberSet.has((r.user_id ?? r.from_user ?? r.author_id) as string);

  // Revisits count too: a solved-then-revisited problem is the loop working.
  const solves = (solvesRes.data ?? []).filter(inSquad) as {
    user_id: string;
    problem_slug: string;
    kind: string;
    duration_sec: number | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
  const revisits = ((await supabase
    .from("problem_events")
    .select("user_id,problem_slug,kind,created_at")
    .eq("kind", "revisited")
    .gte("created_at", from)
    .lte("created_at", to)
  ).data ?? []) as { user_id: string; problem_slug: string; created_at: string }[];

  const approaches = ((approachesRes.data ?? []) as { user_id: string; problem_slug: string }[]).filter(inSquad);
  const primers = ((primersRes.data ?? []) as { author_id: string; pattern: string | null }[]).filter(inSquad);
  const challenges = ((challengesRes.data ?? []) as { from_user: string; status: string }[]).filter(inSquad);

  const allSolves = solves.length + revisits.filter((r) => memberSet.has(r.user_id)).length;

  const perMember = new Map<string, number>();
  for (const s of solves) perMember.set(s.user_id, (perMember.get(s.user_id) ?? 0) + 1);

  const usernameById = new Map(
    ((profilesRes.data ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username])
  );

  const members = [...perMember.entries()]
    .map(([uid, n]) => ({ username: usernameById.get(uid) ?? "someone", solves: n }))
    .sort((a, b) => b.solves - a.solves || a.username.localeCompare(b.username));

  const problems = new Set<string>();
  for (const s of solves) problems.add(s.problem_slug);

  const patterns = new Set<string>();
  for (const p of primers) if (p.pattern) patterns.add(p.pattern);
  for (const a of approaches) if (a.problem_slug) patterns.add(a.problem_slug);

  // Best improvement: same person, same problem, two timed solves, later faster.
  const byPersonProblem = new Map<string, typeof solves>();
  for (const s of solves) {
    if (s.duration_sec == null) continue;
    const key = `${s.user_id}|${s.problem_slug}`;
    const list = byPersonProblem.get(key) ?? [];
    list.push(s);
    byPersonProblem.set(key, list);
  }
  let bestImprovement: SeasonResult["bestImprovement"] = null;
  for (const [key, list] of byPersonProblem) {
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (first.created_at === last.created_at) continue;
    // First is non-null because the loop above skipped null durations, but the
    // array type cannot know that, so the guard is explicit rather than asserted.
    if (first.duration_sec == null) continue;
    if (last.duration_sec == null || last.duration_sec >= first.duration_sec) continue;
    const gain = first.duration_sec - last.duration_sec;
    if (!bestImprovement || gain > bestImprovement.fromSec - bestImprovement.toSec) {
      bestImprovement = {
        username: usernameById.get(key.split("|")[0]) ?? "someone",
        slug: key.split("|")[1],
        fromSec: first.duration_sec,
        toSec: last.duration_sec,
      };
    }
  }

  const result: SeasonResult = {
    seasonId: season.id,
    squadId,
    squadName: squad?.name ?? "A squad",
    name: season.name,
    objective: season.objective,
    startsAt: season.starts_at,
    endsAt: season.ends_at,
    status: season.status,
    solves: allSolves,
    challengesSent: challenges.length,
    challengesCompleted: challenges.filter((c) => c.status === "completed").length,
    approachesWritten: approaches.length,
    primersShared: primers.length,
    activeDays: new Set(
      [...solves, ...revisits].map((s) => (s as { created_at: string }).created_at.slice(0, 10))
    ).size,
    problems: problems.size,
    patterns: patterns.size,
    members,
    bestImprovement,
    headline: "",
  };

  // A headline that reflects what happened, including when little did.
  result.headline =
    result.solves === 0
      ? "No solves logged this season."
      : result.challengesSent === 0
        ? `${result.solves} solves, but nobody challenged anybody — the loop was only half running.`
        : `${result.solves} solves, ${result.challengesSent} challenges out${result.challengesCompleted > 0 ? `, ${result.challengesCompleted} answered` : ""}.`;

  return result;
}

/** Formatted duration for the OG card and the page. */
export { formatDuration };