import { createClient } from "@/lib/supabase/client";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { ReviewItem, ReviewReason, Battle, ProblemEvent } from "@/types/database";
import { DataError } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

const GAP_DAYS = 14;

export interface PatternStat {
  pattern: string;
  exposure: number;
  solved: number;
  failures: number;
  revisits: number;
  novel: number;
  status: "Strong" | "Developing" | "Weak";
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function classifyPattern(s: { exposure: number; solved: number; failures: number; recentFailures: number }): PatternStat["status"] {
  const total = s.solved + s.failures;
  // Actionable estimate, never claimed as proof (Bible §23).
  if (s.recentFailures >= 2) return "Weak";
  if (total >= 3 && s.failures / total > 0.4) return "Weak";
  if (s.solved >= 5 && total > 0 && s.failures / total < 0.2) return "Strong";
  return "Developing";
}

interface Snapshot {
  statuses: { problem_slug: string; status: string; solved_at: string }[];
  battles: Battle[];
  events: ProblemEvent[];
  openRows: ReviewItem[];
  slugPattern: Map<string, string>;
}

/** Gather everything needed to reconcile + display revision state. */
export async function getSnapshot(): Promise<Snapshot> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new DataError("review", "Log in to see your revision queue.");
  const [statusRes, battleRes, eventRes, queueRes] = await Promise.all([
    supabase.from("user_problem_status").select("problem_slug, status, solved_at").eq("user_id", user.id).limit(2000),
    supabase.from("battles").select("*").eq("user_id", user.id).order("started_at", { ascending: false }).limit(300),
    supabase.from("problem_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("review_queue").select("*").eq("user_id", user.id).is("done_at", null),
  ]);
  if (statusRes.error) throw new DataError("review", "Couldn't load progress. Retry.", { cause: statusRes.error });
  const statuses = (statusRes.data ?? []) as Snapshot["statuses"];
  const battles = (battleRes.data ?? []) as Battle[];
  const events = (eventRes.data ?? []) as ProblemEvent[];
  const openRows = (queueRes.data ?? []) as ReviewItem[];

  const slugs = Array.from(new Set([
    ...statuses.map((s) => s.problem_slug),
    ...battles.map((b) => b.problem_slug),
    ...events.map((e) => e.problem_slug),
  ]));
  const catalog = await getCatalogBySlugs(slugs).catch(() => []);
  const slugPattern = new Map(catalog.map((c) => [c.title_slug, c.topics?.[0] ?? "General"]));
  return { statuses, battles, events, openRows, slugPattern };
}

/** Desired open reasons per slug from current reality (pure, testable). */
export function computeDesiredReasons(snap: Snapshot): Map<string, Set<ReviewReason>> {
  const desired = new Map<string, Set<ReviewReason>>();
  const want = (slug: string, reason: ReviewReason) => {
    if (!desired.has(slug)) desired.set(slug, new Set());
    desired.get(slug)!.add(reason);
  };

  const statusBySlug = new Map(snap.statuses.map((s) => [s.problem_slug, s]));
  const latestBattle = new Map<string, Battle>();
  for (const b of snap.battles) {
    if (!latestBattle.has(b.problem_slug)) latestBattle.set(b.problem_slug, b);
  }
  // Events are desc: first occurrence per slug is the latest kind.
  const latestKind = new Map<string, string>();
  for (const e of snap.events) {
    if (!latestKind.has(e.problem_slug)) latestKind.set(e.problem_slug, e.kind);
  }

  // Pattern failure rates (all-time, from events).
  const patTotal = new Map<string, { solved: number; failed: number }>();
  for (const e of snap.events) {
    const pat = snap.slugPattern.get(e.problem_slug) ?? "General";
    const agg = patTotal.get(pat) ?? { solved: 0, failed: 0 };
    if (e.kind === "solved" || e.kind === "revisited" || e.kind === "challenge_completed") agg.solved += 1;
    if (e.kind === "failed") agg.failed += 1;
    patTotal.set(pat, agg);
  }
  const weakPatterns = new Set<string>();
  for (const [pat, agg] of patTotal) {
    const total = agg.solved + agg.failed;
    if (total >= 3 && agg.failed / total > 0.4) weakPatterns.add(pat);
  }

  for (const s of snap.statuses) {
    const slug = s.problem_slug;
    const kind = latestKind.get(slug);
    const battle = latestBattle.get(slug);
    if (s.status !== "solved" && (kind === "failed" || battle?.outcome === "failed")) {
      want(slug, "failed");
    }
    if (s.status === "solved" && daysSince(s.solved_at) > GAP_DAYS) {
      // Gap counts only when nothing recent re-proved it.
      const recentProof = snap.events.some(
        (e) => e.problem_slug === slug &&
          (e.kind === "solved" || e.kind === "revisited" || e.kind === "challenge_completed") &&
          daysSince(e.created_at) <= GAP_DAYS
      );
      if (!recentProof) want(slug, "gap");
    }
    const pat = snap.slugPattern.get(slug);
    if (pat && weakPatterns.has(pat) && s.status !== "solved") want(slug, "weak_pattern");
    if (battle && battle.confidence != null && battle.confidence <= 2 && s.status !== "solved") {
      want(slug, "low_confidence");
    }
  }
  // Failed battles on never-tracked slugs (no status row yet).
  for (const [slug, b] of latestBattle) {
    if (b.outcome === "failed" && !statusBySlug.has(slug)) want(slug, "failed");
  }
  return desired;
}

/**
 * Reconcile review_queue with reality: insert newly-due, resolve cleared.
 * Solved clears failed/low_confidence/weak_pattern/gap for the slug.
 */
export async function refreshReviewQueue(): Promise<ReviewItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const snap = await getSnapshot();
  const desired = computeDesiredReasons(snap);
  const now = new Date().toISOString();

  const openKey = new Set(snap.openRows.map((r) => `${r.problem_slug}|${r.reason}`));
  const solvedSlugs = new Set(snap.statuses.filter((s) => s.status === "solved").map((s) => s.problem_slug));

  const toInsert: { user_id: string; problem_slug: string; reason: ReviewReason; due_at: string }[] = [];
  for (const [slug, reasons] of desired) {
    for (const reason of reasons) {
      if (!openKey.has(`${slug}|${reason}`)) {
        toInsert.push({ user_id: user.id, problem_slug: slug, reason, due_at: now });
      }
    }
  }
  if (toInsert.length > 0) {
    await supabase.from("review_queue").upsert(toInsert, { onConflict: "user_id,problem_slug,reason", ignoreDuplicates: true });
  }

  // Resolve: bookmark rows survive (manual); solved clears auto reasons.
  const autoReasons: ReviewReason[] = ["failed", "gap", "weak_pattern", "low_confidence"];
  const staleIds: string[] = [];
  for (const row of snap.openRows) {
    if (row.reason === "bookmark") continue;
    if (solvedSlugs.has(row.problem_slug) && (row.reason === "failed" || row.reason === "low_confidence")) {
      staleIds.push(row.id);
      continue;
    }
    if (!desired.get(row.problem_slug)?.has(row.reason) && autoReasons.includes(row.reason)) {
      staleIds.push(row.id);
    }
  }
  if (staleIds.length > 0) {
    await supabase.from("review_queue").update({ done_at: now }).in("id", staleIds);
  }

  const { data } = await supabase
    .from("review_queue")
    .select("*")
    .eq("user_id", user.id)
    .is("done_at", null)
    .order("due_at", { ascending: true })
    .limit(100);
  return (data ?? []) as ReviewItem[];
}

export async function getOpenReviews(): Promise<ReviewItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("review_queue")
    .select("*")
    .eq("user_id", user.id)
    .is("done_at", null)
    .order("due_at", { ascending: true })
    .limit(100);
  return (data ?? []) as ReviewItem[];
}

export async function toggleBookmark(problemSlug: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const slug = problemSlug.toLowerCase();
  const { data: existing } = await supabase
    .from("review_queue")
    .select("id")
    .eq("user_id", user.id)
    .eq("problem_slug", slug)
    .eq("reason", "bookmark")
    .is("done_at", null)
    .maybeSingle();
  if (existing) {
    await supabase.from("review_queue").delete().eq("id", (existing as { id: string }).id);
    return false;
  }
  await supabase.from("review_queue").insert({ user_id: user.id, problem_slug: slug, reason: "bookmark" });
  return true;
}

export async function isBookmarked(problemSlug: string): Promise<boolean> {  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("review_queue")
    .select("id")
    .eq("user_id", user.id)
    .eq("problem_slug", problemSlug.toLowerCase())
    .eq("reason", "bookmark")
    .is("done_at", null)
    .maybeSingle();
  return !!data;
}

/** Open review row for one slug (problem page revision state). */
export async function getReviewForSlug(problemSlug: string): Promise<ReviewItem | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("review_queue")
    .select("*")
    .eq("user_id", user.id)
    .eq("problem_slug", problemSlug.toLowerCase())
    .is("done_at", null)
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as ReviewItem | null) ?? null;
}

/** Per-pattern learning estimate (Bible §23). */
export function computePatternStats(snap: Snapshot): PatternStat[] {
  const byPattern = new Map<string, { exposure: Set<string>; solved: number; failures: number; recentFailures: number; revisits: number; novel: Set<string> }>();
  const touch = (pat: string) => {
    if (!byPattern.has(pat)) {
      byPattern.set(pat, { exposure: new Set(), solved: 0, failures: 0, recentFailures: 0, revisits: 0, novel: new Set() });
    }
    return byPattern.get(pat)!;
  };
  for (const s of snap.statuses) {
    const agg = touch(snap.slugPattern.get(s.problem_slug) ?? "General");
    agg.exposure.add(s.problem_slug);
    if (s.status === "solved") agg.solved += 1;
  }
  const solvesPerSlug = new Map<string, number>();
  for (const e of snap.events) {
    const agg = touch(snap.slugPattern.get(e.problem_slug) ?? "General");
    if (e.kind === "failed") {
      agg.failures += 1;
      if (daysSince(e.created_at) <= 30) agg.recentFailures += 1;
    }
    if (e.kind === "solved" || e.kind === "challenge_completed") {
      solvesPerSlug.set(e.problem_slug, (solvesPerSlug.get(e.problem_slug) ?? 0) + 1);
    }
    if (e.kind === "revisited") agg.revisits += 1;
  }
  for (const [slug, n] of solvesPerSlug) {
    if (n >= 1) touch(snap.slugPattern.get(slug) ?? "General").novel.add(slug);
  }
  return Array.from(byPattern.entries())
    .map(([pattern, a]) => ({
      pattern,
      exposure: a.exposure.size,
      solved: a.solved,
      failures: a.failures,
      revisits: a.revisits,
      novel: a.novel.size,
      status: classifyPattern({ exposure: a.exposure.size, solved: a.solved, failures: a.failures, recentFailures: a.recentFailures }),
    }))
    .sort((x, y) => y.exposure - x.exposure);
}

export function logRevisit(problemSlug: string, battleId?: string | null, durationSec?: number | null) {
  track("revisit_done", { problem_slug: problemSlug });
  return import("@/lib/data/problemEvents").then(({ logProblemEvent }) =>
    logProblemEvent({ problemSlug, kind: "revisited", battleId: battleId ?? null, durationSec: durationSec ?? null })
  );
}
