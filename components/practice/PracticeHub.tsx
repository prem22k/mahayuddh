"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { listPrimers } from "@/lib/data/primers";
import {
  refreshReviewQueue,
  getSnapshot,
  computePatternStats,
  PatternStat,
} from "@/lib/data/review";
import { buildRevengeOffer, RevengeOffer } from "@/lib/revenge";
import { getOpenRevenges } from "@/lib/data/revenge";
import { getListWithProblems, getSquadProblemStatuses } from "@/lib/data/sheets";
import { dataErrorMessage } from "@/lib/data/errors";
import { formatDuration, relativeDays } from "@/lib/format";
import { Primer, Problem, ReviewItem, ReviewReason } from "@/types/database";

function reasonLine(
  r: ReviewItem,
  meta: Problem | undefined,
  revenge: RevengeOffer | undefined
): string {
  if (revenge) {
    const dur = formatDuration(revenge.previousFailedSec);
    const when = relativeDays(revenge.daysAgo);
    if (dur) return `Revenge · you stopped at ${dur} ${when}`;
    return `Revenge · failed ${when}`;
  }
  switch (r.reason as ReviewReason) {
    case "failed":
      return "Failed · take revenge";
    case "gap":
      return "Fading · due for a revisit";
    case "weak_pattern": {
      const topic = meta?.topics?.[0];
      return topic ? `Weak pattern · ${topic}` : "Weak pattern";
    }
    case "bookmark":
      return "Bookmarked";
    case "low_confidence":
      return "Low confidence";
    default:
      return "Due for review";
  }
}

const SHEETS = [
  { slug: "neetcode-150", title: "NeetCode 150" },
  { slug: "blind-75", title: "Blind 75" },
  { slug: "striver-sde", title: "Striver SDE" },
] as const;

export function PracticeHub() {
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [patterns, setPatterns] = useState<PatternStat[]>([]);
  const [titles, setTitles] = useState<Map<string, Problem>>(new Map());
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [revenges, setRevenges] = useState<Map<string, RevengeOffer>>(new Map());
  const [sheetProgress, setSheetProgress] = useState<
    Record<string, { total: number; solved: number } | null>
  >({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([refreshReviewQueue().catch(() => [] as ReviewItem[]), getSnapshot().catch(() => null), listPrimers().catch(() => [] as Primer[])])
      .then(async ([rows, snap, prim]) => {
        setReviews(rows);
        setPrimers(prim);
        if (snap) {
          setPatterns(computePatternStats(snap));
          const slugs = Array.from(new Set(rows.map((r) => r.problem_slug))).slice(0, 60);
          const catalog = await getCatalogBySlugs(slugs).catch(() => []);
          setTitles(new Map(catalog.map((c) => [c.title_slug, c])));

          // Revenge (Step 17): a failed problem with its real failure time on it,
          // rather than a bare "Failed" label.
          const failedSlugs = rows.filter((r) => r.reason === "failed").map((r) => r.problem_slug);
          if (failedSlugs.length > 0) {
            const battlesBySlug = await getOpenRevenges(failedSlugs).catch(() => new Map());
            const offers = new Map<string, RevengeOffer>();
            for (const slug of failedSlugs) {
              const offer = buildRevengeOffer(slug, battlesBySlug.get(slug) ?? []);
              if (offer) offers.set(slug, offer);
            }
            setRevenges(offers);
          } else {
            setRevenges(new Map());
          }
        }
      })
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load practice data.")))
      .finally(() => setLoading(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sheet progress is honest measured data only: list size plus your own
  // solved marks. When either fetch fails the row renders without counts.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, { total: number; solved: number } | null> = {};
      await Promise.all(
        SHEETS.map(async (s) => {
          try {
            const { problems } = await getListWithProblems(s.slug);
            const slugs = problems.map((p) => p.title_slug);
            const statuses = await getSquadProblemStatuses(slugs, user.id).catch(() => []);
            const solved = new Set(
              statuses.filter((st) => st.status === "solved").map((st) => st.problem_slug)
            );
            out[s.slug] = { total: problems.length, solved: solved.size };
          } catch {
            out[s.slug] = null;
          }
        })
      );
      if (!cancelled) setSheetProgress(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <EmptyState
        heading="Log in to get your review queue"
        body="Failed battles, fading solves, and bookmarks queue here automatically."
        action={
          <Link
            href="/login"
            className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover md:min-h-0"
          >
            Log in
          </Link>
        }
      />
    );
  }
  if (loading) {
    return (
      <div className="space-y-8" aria-hidden>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (loadError) {
    return <ErrorCard message={loadError} />;
  }

  const weak = patterns.filter((p) => p.status === "Weak").slice(0, 6);
  const visible = reviews.filter((r) => !skipped.has(r.id)).slice(0, 12);
  const [featured, ...rest] = visible;

  const startRevision = (slug: string) => {
    const meta = titles.get(slug);
    startSolving({
      id: meta?.question_id || slug,
      title: meta?.title || slug,
      slug,
      difficulty: meta?.difficulty || "Medium",
      category: meta?.topics?.[0] || "Revision",
    });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
      {/* Focal column */}
      <div className="min-w-0 space-y-8">
        <section aria-labelledby="due-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="due-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
              Due for review
            </h2>
            {visible.length > 0 && (
              <span className="font-mono text-xs text-text-tertiary tnum">{visible.length}</span>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              heading="Nothing due right now"
              body="Today's battle is still open. Failed battles and fading solves will queue here."
              action={
                <Link
                  href="/"
                  className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
                >
                  Go to today&apos;s battle
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {featured && (
                <FeaturedReview
                  item={featured}
                  meta={titles.get(featured.problem_slug)}
                  revenge={revenges.get(featured.problem_slug)}
                  onStart={() => startRevision(featured.problem_slug)}
                  onSkip={() =>
                    setSkipped((prev) => new Set(prev).add(featured.id))
                  }
                />
              )}
              {rest.map((r) => {
                const meta = titles.get(r.problem_slug);
                const revenge = revenges.get(r.problem_slug);
                return (
                  <div
                    key={r.id}
                    className="flex min-h-[48px] flex-col gap-2 rounded-xl border border-hairline bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/practice/${r.problem_slug}`}
                        className="block truncate text-sm font-medium leading-5 text-text-primary hover:underline"
                      >
                        {meta?.title || r.problem_slug}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {meta && (
                          <span className="font-mono text-xs text-text-tertiary tnum">
                            No. {meta.question_id}
                          </span>
                        )}
                        {meta && <DifficultyBadgeNew difficulty={meta.difficulty} />}
                        {meta?.topics?.[0] && (
                          <PatternChip
                            label={meta.topics[0]}
                            href={`/patterns/${encodeURIComponent(meta.topics[0])}`}
                          />
                        )}
                        <span className="text-xs leading-4 text-text-secondary">
                          {reasonLine(r, meta, revenge)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => startRevision(r.problem_slug)}
                      className="min-h-[44px] shrink-0 md:min-h-0"
                    >
                      {revenge ? "Take revenge" : r.reason === "failed" ? "Retry" : "Revisit"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="sheets-heading" className="space-y-3">
          <h2 id="sheets-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
            Start something new
          </h2>
          <div className="space-y-2">
            {SHEETS.map((s) => {
              const prog = sheetProgress[s.slug];
              const pct =
                prog && prog.total > 0 ? Math.round((prog.solved / prog.total) * 100) : null;
              return (
                <div
                  key={s.slug}
                  className="flex min-h-[48px] items-center gap-4 rounded-xl border border-hairline bg-surface px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/sheets/${s.slug}`}
                      className="block truncate text-sm font-medium leading-5 text-text-primary hover:underline"
                    >
                      {s.title}
                    </Link>
                    {prog ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-overlay"
                          role="progressbar"
                          aria-valuenow={pct ?? 0}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${s.title} progress`}
                        >
                          <div
                            className="h-full rounded-full bg-text-primary"
                            style={{ width: `${Math.max(pct ?? 0, 2)}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                          {prog.solved} of {prog.total} · {pct}%
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <Link
                    href={`/sheets/${s.slug}`}
                    className="inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
                  >
                    Open
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Rail */}
      <div className="min-w-0 space-y-8">
        {weak.length > 0 && (
          <section aria-labelledby="weak-heading" className="space-y-3">
            <div>
              <h2 id="weak-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
                Weak patterns
              </h2>
              <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
                An estimate from your history, not a grade.
              </p>
            </div>
            <div className="space-y-2">
              {weak.map((p) => (
                <Link
                  key={p.pattern}
                  href={`/patterns/${encodeURIComponent(p.pattern)}`}
                  className="card-interactive flex min-h-[48px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <PatternChip label={p.pattern} />
                    <span className="mt-1 block font-mono text-xs text-text-tertiary tnum">
                      {p.solved} solved · {p.failures} failed · {p.revisits} revisits
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {primers.length > 0 && (
          <section aria-labelledby="primer-heading" className="space-y-3">
            <h2 id="primer-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
              Learn a pattern first
            </h2>
            <div className="space-y-2">
              {primers.slice(0, 4).map((p) => (
                <Link
                  key={p.slug}
                  href={`/primers/${p.slug}`}
                  className="card-interactive flex min-h-[48px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-2.5"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-pattern" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-text-tertiary">
                      {p.starter_slugs.length} starter problems
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FeaturedReview({
  item,
  meta,
  revenge,
  onStart,
  onSkip,
}: {
  item: ReviewItem;
  meta: Problem | undefined;
  revenge: RevengeOffer | undefined;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="card space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {meta && (
            <span className="font-mono text-xs text-text-tertiary tnum">
              No. {meta.question_id}
            </span>
          )}
          {meta && <DifficultyBadgeNew difficulty={meta.difficulty} />}
          {meta?.topics?.[0] && (
            <PatternChip
              label={meta.topics[0]}
              href={`/patterns/${encodeURIComponent(meta.topics[0])}`}
            />
          )}
        </div>
        <Link
          href={`/practice/${item.problem_slug}`}
          className="mt-1 block font-display text-2xl font-semibold leading-[29px] tracking-[-0.015em] text-text-primary hover:underline"
        >
          {meta?.title || revenge?.title || item.problem_slug}
        </Link>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {reasonLine(item, meta, revenge)}
          {revenge && revenge.failureCount > 1 && (
            <span className="text-text-tertiary"> · {revenge.failureCount} failed attempts</span>
          )}
          {/*
            The queue reasons are rule-based with a fixed gap, not spaced
            repetition — so the UI says "Due for review", never that. The
            low-confidence reason needs a confidence rating that no UI sets.
          */}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant="primary"
          onClick={onStart}
          className="min-h-[44px] md:min-h-0"
        >
          <Play className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
          {revenge ? "Take revenge" : item.reason === "failed" ? "Retry" : "Revisit"}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className={cn("min-h-[44px] md:min-h-0")}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
