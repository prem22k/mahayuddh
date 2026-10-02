import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import {
  buildSignalsFromEvents,
  recommendNextBattle,
  type ProblemSignal,
  type PatternSignal,
  type RecommendOptions,
  type Recommendation,
  type RecommendationCandidate,
} from "@/lib/recommend";
import type { ProblemEvent } from "@/types/database";

/**
 * Recommendation engine data (Step 24, Bible §24).
 *
 * The engine itself is pure (lib/recommend.ts). This module only assembles the
 * inputs from rows that already exist — §24 forbids an ML model and a
 * black-box score, and a black box would also be untestable in this repo's
 * style, so the aggregation lives where a unit test can reach it.
 */

export type RecSurface = "home" | "practice_hub" | "problem";

/**
 * Load the caller's history and derive pattern + problem signals.
 *
 * Patterns come from the catalog's `topics`, joined by slug, because
 * problem_events carries no pattern of its own. A slug with no catalog row gets
 * an empty pattern list and therefore contributes no pattern signal — it can
 * still be recommended on its per-problem signals, but nothing claims to know
 * its pattern.
 */
async function loadSignals(): Promise<{
  patterns: Map<string, PatternSignal>;
  problems: Map<string, ProblemSignal>;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { patterns: new Map(), problems: new Map() };

  const { data: events, error } = await supabase
    .from("problem_events")
    .select("problem_slug,kind,created_at,duration_sec")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw new DataError("recommend", "Couldn't read your history. Retry.", { cause: error });

  const rows = (events ?? []) as Pick<
    ProblemEvent,
    "problem_slug" | "kind" | "created_at" | "duration_sec"
  >[];

  const slugs = Array.from(new Set(rows.map((r) => r.problem_slug.toLowerCase()))).slice(0, 800);
  const patternsBySlug = new Map<string, string[]>();
  if (slugs.length > 0) {
    const { data: catalog } = await supabase
      .from("problems")
      .select("title_slug,topics")
      .in("title_slug", slugs);
    for (const p of (catalog ?? []) as { title_slug: string; topics: string[] }[]) {
      if (p.topics?.length) patternsBySlug.set(p.title_slug.toLowerCase(), p.topics);
    }
  }

  return buildSignalsFromEvents(
    rows.map((r) => ({
      problem_slug: r.problem_slug.toLowerCase(),
      kind: r.kind,
      created_at: r.created_at,
      duration_sec: r.duration_sec,
      patternsBySlug,
    }))
  );
}

/**
 * Problems to consider: the caller's current sheet, unsolved first.
 *
 * Scoped to one list on purpose. Recommending from the whole 3000-problem
 * catalog would surface problems from a curriculum they are not following, and
 * the why-bullets would be about patterns they have no reason to be in.
 */
export async function getRecommendation(
  opts: { sheetSlug?: string | null; goalPattern?: string | null; limit?: number } = {},
  options: RecommendOptions = {}
): Promise<Recommendation | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sheetSlug = opts.sheetSlug ?? "neetcode-150";
  const { data: listRows, error: listErr } = await supabase
    .from("list_problems")
    .select("title_slug,category")
    .eq("list_slug", sheetSlug)
    .limit(400);
  if (listErr) throw new DataError("recommend", "Couldn't load your sheet. Retry.", { cause: listErr });

  const slugs = Array.from(new Set((listRows ?? []).map((r) => (r as { title_slug: string }).title_slug)));
  if (slugs.length === 0) return null;

  const { data: statusRows } = await supabase
    .from("user_problem_status")
    .select("problem_slug,status")
    .eq("user_id", user.id)
    .in("problem_slug", slugs);
  const status = new Map(
    ((statusRows ?? []) as { problem_slug: string; status: string }[]).map((r) => [
      r.problem_slug.toLowerCase(),
      r.status,
    ])
  );

  // Only unsolved problems are candidates: suggesting a solved problem is the
  // single most obviously broken thing a "next battle" engine can do.
  const unsolved = slugs.filter((s) => status.get(s.toLowerCase()) !== "solved");
  if (unsolved.length === 0) return null;

  const { data: catalog } = await supabase
    .from("problems")
    .select("title_slug,title,difficulty,topics")
    .in("title_slug", unsolved.slice(0, opts.limit ?? 400));
  const bySlug = new Map(
    ((catalog ?? []) as { title_slug: string; title: string; difficulty: string; topics: string[] }[]).map((p) => [
      p.title_slug.toLowerCase(),
      p,
    ])
  );

  const categoryBySlug = new Map(
    ((listRows ?? []) as { title_slug: string; category: string }[]).map((r) => [
      r.title_slug.toLowerCase(),
      r.category,
    ])
  );

  const candidates: RecommendationCandidate[] = [];
  for (const slug of unsolved) {
    const key = slug.toLowerCase();
    const row = bySlug.get(key);
    if (!row) continue;
    // Topics AND the sheet category: the same problem can be catalogued as
    // "Graphs" on a sheet and "Depth-First Search" in the topic list, and
    // dropping either would throw away a real prerequisite signal.
    const patterns = Array.from(
      new Set([...(row.topics ?? []), categoryBySlug.get(key) ?? ""].filter(Boolean))
    );
    candidates.push({
      titleSlug: row.title_slug,
      title: row.title,
      difficulty: (row.difficulty === "Easy" || row.difficulty === "Hard" ? row.difficulty : "Medium") as
        | "Easy"
        | "Medium"
        | "Hard",
      patterns,
    });
  }

  const { patterns, problems } = await loadSignals();

  return recommendNextBattle(
    {
      candidates,
      patterns,
      problems,
      goalPattern: opts.goalPattern ?? null,
    },
    options
  );
}

// ── Logging (§24: store recommendation + accepted/rejected) ──────────────────

/**
 * Record that a recommendation was shown. Fire-and-forget by contract: a
 * failure to log must never break the surface that was showing it.
 */
export async function logRecommendationShown(
  rec: Recommendation,
  surface: RecSurface
): Promise<void> {
  const supabase = createClient();
  await supabase.from("recommendation_log").insert({
    problem_slug: rec.problem.titleSlug.toLowerCase(),
    problem_title: rec.problem.title,
    difficulty: rec.problem.difficulty,
    pattern: rec.problem.patterns[0] ?? null,
    why_json: rec.why,
    decision: "shown",
    surface,
  });
}

/**
 * Record the decision.
 *
 * Accepted means the person started this problem from the recommendation, which
 * is the accept rate §24 asks to be able to measure. Dismissed is "I am not
 * doing this one" and is deliberately distinct from rejected, so a weak signal
 * can be told apart from a wrong problem.
 */
export async function logRecommendationDecision(
  rec: Recommendation,
  surface: RecSurface,
  decision: "accepted" | "rejected" | "dismissed"
): Promise<void> {
  const supabase = createClient();
  await supabase.from("recommendation_log").insert({
    problem_slug: rec.problem.titleSlug.toLowerCase(),
    problem_title: rec.problem.title,
    difficulty: rec.problem.difficulty,
    pattern: rec.problem.patterns[0] ?? null,
    why_json: rec.why,
    decision,
    surface,
  });
}

/** The caller's own accept rate, for the "is this helping you?" readout. */
export async function getRecommendationAcceptRate(): Promise<{
  shown: number;
  accepted: number;
  rate: number | null;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("recommendation_log")
    .select("decision")
    .eq("user_id", user.id)
    .in("decision", ["shown", "accepted"]);
  const rows = (data ?? []) as { decision: string }[];
  const shown = rows.filter((r) => r.decision === "shown").length;
  const accepted = rows.filter((r) => r.decision === "accepted").length;
  if (shown === 0 && accepted === 0) return null;
  return {
    shown: shown + accepted,
    accepted,
    // Null rather than 0 when nothing was ever shown: "0% accept rate" after
    // zero recommendations would be a factually wrong thing to show somebody.
    rate: shown + accepted === 0 ? null : accepted / (shown + accepted),
  };
}