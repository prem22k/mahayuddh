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
export interface SeasonObjectiveProgress {
  target: number;
  pattern: string | null;
  /** Squad solve events in the season window (revisits included). */
  done: number;
  /**
   * True only when `done` counts pattern-matching solves. False when there is
   * no pattern or the pattern filter wasn't measurable — then `done` counts
   * all solves and the UI must label it honestly.
   */
  filtered: boolean;
  /** "measured" from objective_target, "parsed" from the free-text fallback. */
  basis: "measured" | "parsed";
}

export interface SeasonResult {
  seasonId: string;
  squadId: string;
  squadName: string;
  name: string;
  objective: string | null;
  objectiveTarget: number | null;
  objectivePattern: string | null;
  /** Null when there is nothing measurable and nothing parseable. */
  objectiveProgress: SeasonObjectiveProgress | null;
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
    .select("*")
    .eq("id", seasonId)
    .eq("squad_id", squadId)
    .maybeSingle();
  if (!season) return null;
  const seasonRow = season as {
    id: string;
    squad_id: string;
    name: string;
    objective: string | null;
    objective_target?: number | null;
    objective_pattern?: string | null;
    starts_at: string;
    ends_at: string | null;
    status: "upcoming" | "active" | "complete";
  };

  const { data: squad } = await supabase
    .from("squads")
    .select("id,name")
    .eq("id", squadId)
    .maybeSingle();

  const memberIds = (
    await supabase.from("squad_members").select("user_id").eq("squad_id", squadId)
  ).data?.map((m) => ({ user_id: (m as { user_id: string }).user_id })) ?? [];

  const from = new Date(seasonRow.starts_at).toISOString();
  const to = seasonRow.ends_at
    ? new Date(new Date(seasonRow.ends_at).getTime() + 86_400_000).toISOString()
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
    seasonId: seasonRow.id,
    squadId,
    squadName: squad?.name ?? "A squad",
    name: seasonRow.name,
    objective: seasonRow.objective,
    objectiveTarget:
      typeof seasonRow.objective_target === "number" && seasonRow.objective_target > 0
        ? seasonRow.objective_target
        : null,
    objectivePattern: seasonRow.objective_pattern?.trim() || null,
    objectiveProgress: null,
    startsAt: seasonRow.starts_at,
    endsAt: seasonRow.ends_at,
    status: seasonRow.status,
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

  // Measured objective progress. A stored target wins; the free-text parse is
  // only a labeled fallback, and a pattern scope only narrows the count when
  // the catalog can actually measure it.
  const windowSlugs = [
    ...solves.map((s) => s.problem_slug),
    ...revisits.filter((r) => memberSet.has(r.user_id)).map((r) => r.problem_slug),
  ];
  if (result.objectiveTarget != null) {
    const pattern = result.objectivePattern;
    const done = pattern
      ? await countSlugsMatchingPattern(supabase, windowSlugs, pattern, allSolves)
      : { done: allSolves, filtered: false };
    result.objectiveProgress = {
      target: result.objectiveTarget,
      pattern,
      done: done.done,
      filtered: done.filtered,
      basis: "measured",
    };
  } else if (result.objective) {
    const parsed = parseSeasonObjectiveText(result.objective);
    if (parsed) {
      const done = parsed.pattern
        ? await countSlugsMatchingPattern(supabase, windowSlugs, parsed.pattern, allSolves)
        : { done: allSolves, filtered: false };
      result.objectiveProgress = {
        target: parsed.target,
        pattern: parsed.pattern,
        done: done.done,
        filtered: done.filtered,
        basis: "parsed",
      };
    }
  }

  return result;
}

/**
 * Fallback parse of a free-text objective like "41 of 40 graph problems".
 * Only matches when the text names a count of problems:
 * /(\d+)\s*(\w+)?\s*problems/i. The target is the last number in the string
 * ("41 of 40" -> 40); the pattern is the word before "problems", or null for
 * a bare "N problems". Anything else returns null — never invent a target.
 */
export function parseSeasonObjectiveText(text: string): { target: number; pattern: string | null } | null {
  if (!/problems/i.test(text)) return null;
  const numbers = [...text.matchAll(/(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (numbers.length === 0) return null;
  const target = numbers[numbers.length - 1];
  if (!Number.isFinite(target) || target <= 0 || target > 100000) return null;
  const patternMatch = text.match(/([A-Za-z][\w&+\- ]*?)\s+problems/i);
  let pattern: string | null = null;
  if (patternMatch) {
    const words = patternMatch[1].trim().split(/\s+/);
    const last = words[words.length - 1];
    // Skip quantifiers ("40 graph" -> pattern "graph", not "40").
    pattern = /^\d+$/.test(last) ? null : last || null;
    // A bare "N problems" yields the number as the "pattern" — drop it.
    if (pattern && /^\d+$/.test(pattern)) pattern = null;
  }
  return { target, pattern };
}

/** Count window slugs carrying a pattern's topic; falls back to all solves. */
async function countSlugsMatchingPattern(
  supabase: ReturnType<typeof getServiceClient> & object,
  windowSlugs: string[],
  pattern: string,
  fallback: number
): Promise<{ done: number; filtered: boolean }> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (col: string, vals: string[]) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  try {
    const unique = Array.from(new Set(windowSlugs.map((s) => s.toLowerCase())));
    if (unique.length === 0) return { done: 0, filtered: true };
    const topicsBySlug = new Map<string, string[]>();
    for (let i = 0; i < unique.length; i += 200) {
      const slice = unique.slice(i, i + 200);
      const res = await client.from("problems").select("title_slug, topics").in("title_slug", slice);
      const rows = (res.data ?? []) as { title_slug: string; topics: string[] }[];
      for (const r of rows) topicsBySlug.set(r.title_slug.toLowerCase(), r.topics ?? []);
    }
    if (topicsBySlug.size === 0) return { done: fallback, filtered: false };
    const pat = pattern.toLowerCase();
    const matches = (topics: string[]) =>
      topics.some((t) => {
        const low = t.toLowerCase();
        return low.includes(pat) || pat.includes(low);
      });
    let done = 0;
    for (const slug of unique) {
      const topics = topicsBySlug.get(slug);
      // Slugs missing from the catalog are unmeasurable for a pattern scope:
      // skip them rather than counting them as pattern solves.
      if (topics && matches(topics)) {
        done += windowSlugs.filter((s) => s.toLowerCase() === slug).length;
      }
    }
    return { done, filtered: true };
  } catch {
    return { done: fallback, filtered: false };
  }
}

/** Formatted duration for the OG card and the page. */
export { formatDuration };