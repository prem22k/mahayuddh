"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, BookOpen, ChevronRight, RotateCcw, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { ProblemRow, StatusGlyph, ProblemStatus } from "@/components/ui/ProblemRow";
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
import { getPinnedSheetProgress, PINNED_SHEETS, SheetProgress } from "@/lib/data/sheetProgress";
import { dataErrorMessage } from "@/lib/data/errors";
import { daysBetween, formatDuration } from "@/lib/format";
import { Primer, Problem, ReviewItem, ReviewReason } from "@/types/database";

type OwnStatus = { status: string; solved_at: string };

/** "today" / "1 day ago" / "<mono>24</mono> days ago" — the number reads as data. */
function agoNode(days: number): React.ReactNode {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return (
    <>
      <span className="font-mono tnum text-text-secondary">{days}</span> days ago
    </>
  );
}

interface Reason {
  /** The short label ("Revenge", "Fading", "Weak pattern"). */
  label: string;
  /** Failure-shaped reasons read in the error color; the rest stay quiet. */
  urgent: boolean;
  detail: React.ReactNode | null;
}

function reasonFor(
  r: ReviewItem,
  meta: Problem | undefined,
  revenge: RevengeOffer | undefined,
  own: OwnStatus | undefined
): Reason {
  if (revenge) {
    const dur = formatDuration(revenge.previousFailedSec);
    return {
      label: "Revenge",
      urgent: true,
      detail: dur ? (
        <>
          you stopped at <span className="font-mono tnum text-text-primary">{dur}</span>{" "}
          {agoNode(revenge.daysAgo)}
        </>
      ) : (
        <>failed {agoNode(revenge.daysAgo)}</>
      ),
    };
  }
  switch (r.reason as ReviewReason) {
    case "failed":
      return { label: "Failed", urgent: true, detail: "take revenge" };
    case "gap":
      return {
        label: "Fading",
        urgent: false,
        detail:
          own?.status === "solved" && own.solved_at ? (
            <>solved {agoNode(daysBetween(own.solved_at))}</>
          ) : (
            "due for a revisit"
          ),
      };
    case "weak_pattern": {
      const topic = meta?.topics?.[0];
      return {
        label: "Weak pattern",
        urgent: true,
        detail: topic ? <span className="text-pattern">{topic}</span> : null,
      };
    }
    case "bookmark":
      return { label: "Bookmarked", urgent: false, detail: null };
    case "low_confidence":
      return { label: "Low confidence", urgent: false, detail: null };
    default:
      return { label: "Due for review", urgent: false, detail: null };
  }
}

/** Desktop/rail reason line: quiet label · detail. */
function ReasonText({ reason }: { reason: Reason }) {
  return (
    <>
      {reason.label}
      {reason.detail && (
        <>
          {" · "}
          {reason.detail}
        </>
      )}
    </>
  );
}

function actionLabel(r: ReviewItem, revenge: RevengeOffer | undefined, own: OwnStatus | undefined) {
  if (revenge) return "Take revenge";
  if (r.reason === "failed") return "Retry";
  // Never touched: there is nothing to revisit yet.
  if (!own) return "Start";
  return "Revisit";
}

/**
 * Row glyph from real state only. A solved-and-fading problem and a failed
 * one both show the half ring ("attempted" is true of both); untouched
 * problems show the empty ring. Verified/self-reported glyphs are left to
 * surfaces that know the evidence.
 */
function glyphFor(own: OwnStatus | undefined, failed: boolean): ProblemStatus {
  if (failed || own) return "attempted";
  return "none";
}

export function PracticeHub() {
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [patterns, setPatterns] = useState<PatternStat[]>([]);
  const [titles, setTitles] = useState<Map<string, Problem>>(new Map());
  const [ownStatus, setOwnStatus] = useState<Map<string, OwnStatus>>(new Map());
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [revenges, setRevenges] = useState<Map<string, RevengeOffer>>(new Map());
  const [sheetProgress, setSheetProgress] = useState<Record<string, SheetProgress | null>>({});
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
          setOwnStatus(
            new Map(snap.statuses.map((s) => [s.problem_slug, { status: s.status, solved_at: s.solved_at }]))
          );
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
  // Shared (and cached) with the sidebar's pinned sheets.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPinnedSheetProgress(user.id)
      .then((out) => {
        if (!cancelled) setSheetProgress(out);
      })
      .catch(() => {
        if (!cancelled) setSheetProgress({});
      });
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
      <div className="space-y-6 md:space-y-12" aria-hidden>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-3 lg:col-span-8">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="space-y-3 lg:col-span-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
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
  const shownPrimers = primers.slice(0, 4);

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
    <div className="space-y-6 md:space-y-12">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Focal column */}
        <section aria-labelledby="due-heading" className="min-w-0 space-y-3 lg:col-span-8">
          <div className="flex items-center gap-2.5 md:mb-0.5">
            <h2
              id="due-heading"
              className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
            >
              Due for review
            </h2>
            {visible.length > 0 && (
              <span className="rounded-xs border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-xs font-medium tracking-[0.06em] text-text-secondary tnum md:rounded-full">
                {visible.length}
              </span>
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
                  own={ownStatus.get(featured.problem_slug)}
                  onStart={() => startRevision(featured.problem_slug)}
                  onSkip={() =>
                    setSkipped((prev) => new Set(prev).add(featured.id))
                  }
                />
              )}
              {rest.length > 0 && (
                <div className="flex flex-col gap-3 md:gap-2">
                  {rest.map((r) => (
                    <ReviewRow
                      key={r.id}
                      item={r}
                      meta={titles.get(r.problem_slug)}
                      revenge={revenges.get(r.problem_slug)}
                      own={ownStatus.get(r.problem_slug)}
                      onStart={() => startRevision(r.problem_slug)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Rail */}
        {(weak.length > 0 || shownPrimers.length > 0) && (
          <aside className="flex min-w-0 flex-col gap-6 lg:col-span-4 lg:gap-8">
            {weak.length > 0 && (
              <section aria-labelledby="weak-heading" className="space-y-3">
                <div>
                  <h2
                    id="weak-heading"
                    className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
                  >
                    Weak patterns
                  </h2>
                  <p className="mt-0.5 text-xs font-medium leading-4 text-text-secondary md:text-text-tertiary">
                    An estimate from your history, not a grade.
                  </p>
                </div>
                <div className="space-y-2 md:space-y-2.5">
                  {weak.map((p) => (
                    <Link
                      key={p.pattern}
                      href={`/patterns/${encodeURIComponent(p.pattern)}`}
                      className="group flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:bg-surface-raised md:rounded-md md:p-3.5"
                    >
                      <span className="flex min-w-0 flex-col items-start gap-1.5">
                        <PatternChip label={p.pattern} className="max-w-full truncate" />
                        <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-secondary tnum">
                          {p.solved} solved ·{" "}
                          <span className={cn(p.failures > 0 && "text-error")}>
                            {p.failures} failed
                          </span>
                          {p.revisits > 0 && (
                            <>
                              {" "}
                              · {p.revisits} {p.revisits === 1 ? "revisit" : "revisits"}
                            </>
                          )}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-[18px] w-[18px] shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
                        strokeWidth={1.5}
                      />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {shownPrimers.length > 0 && (
              <section aria-labelledby="primer-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      className="hidden h-[18px] w-[18px] text-text-tertiary md:block"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <h2
                      id="primer-heading"
                      className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
                    >
                      Learn a pattern first
                    </h2>
                  </div>
                  <span className="font-mono text-xs font-medium text-text-tertiary tnum md:hidden">
                    {shownPrimers.length} {shownPrimers.length === 1 ? "primer" : "primers"} ready
                  </span>
                </div>
                <div className="space-y-2">
                  {shownPrimers.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/primers/${p.slug}`}
                      className="group flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3.5 transition-colors hover:border-hairline-strong md:rounded-md md:p-3 md:hover:border-hairline md:hover:bg-surface-raised"
                    >
                      <span className="flex min-w-0 items-start gap-2.5">
                        <BookMarked
                          className="mt-0.5 h-[18px] w-[18px] shrink-0 text-pattern"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold leading-5 text-text-primary md:font-medium">
                            {p.title}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs font-medium leading-4 text-text-secondary tnum md:font-sans md:text-text-tertiary">
                            {p.starter_slugs.length} starter{" "}
                            {p.starter_slugs.length === 1 ? "problem" : "problems"}
                          </span>
                        </span>
                      </span>
                      <ChevronRight
                        className="hidden h-[18px] w-[18px] shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary md:block"
                        strokeWidth={1.5}
                      />
                      <span className="inline-flex h-10 min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-3.5 text-xs font-medium text-text-primary md:hidden">
                        Read
                        <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>

      {/* Full width: sheets to start */}
      <section aria-labelledby="sheets-heading" className="space-y-3 md:space-y-4">
        <h2
          id="sheets-heading"
          className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
        >
          Start something new
        </h2>
        <div className="space-y-2.5 md:space-y-3">
          {PINNED_SHEETS.map((s) => (
            <SheetRow key={s.slug} slug={s.slug} title={s.title} prog={sheetProgress[s.slug] ?? null} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SheetRow({ slug, title, prog }: { slug: string; title: string; prog: SheetProgress | null }) {
  const pct = prog && prog.total > 0 ? Math.round((prog.solved / prog.total) * 100) : null;
  // Past halfway reads as progress made (verified green); below it, gold.
  const fill = pct != null && pct > 50 ? "bg-verified" : "bg-primary";
  const bar = prog ? (
    <div
      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-well"
      role="progressbar"
      aria-valuenow={pct ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${title} progress`}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct ?? 0}%` }} />
    </div>
  ) : null;

  return (
    <Link
      href={`/sheets/${slug}`}
      className="group block rounded-lg border border-hairline bg-surface p-3.5 transition-colors hover:bg-surface-raised md:flex md:items-center md:justify-between md:gap-6 md:rounded-md md:p-4"
    >
      {/* Mobile: name + count, then the bar */}
      <span className="block space-y-2 md:hidden">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold leading-5 text-text-primary">{title}</span>
          {prog && (
            <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-secondary tnum">
              {prog.solved}/{prog.total} · {pct}%
            </span>
          )}
        </span>
        {bar && <span className="flex">{bar}</span>}
      </span>

      {/* Desktop: name · bar · count · Open */}
      <span className="hidden w-48 shrink-0 truncate text-sm font-medium leading-5 text-text-primary md:block">
        {title}
      </span>
      <span className="hidden max-w-xl flex-1 items-center gap-4 md:flex">
        {prog && (
          <>
            {bar}
            <span className="shrink-0 whitespace-nowrap text-right font-mono text-xs font-medium tracking-[0.06em] text-text-secondary tnum">
              {prog.solved} of {prog.total} · {pct}%
            </span>
          </>
        )}
      </span>
      <span className="hidden shrink-0 rounded-xs border border-hairline px-3.5 py-1.5 text-sm font-medium leading-5 text-text-secondary transition-colors group-hover:bg-surface-overlay group-hover:text-text-primary md:inline-flex">
        Open
      </span>
    </Link>
  );
}

/** Error ring with a dot: the hero's "you stopped here" glyph. */
function FailedGlyph() {
  return (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-error/80"
      aria-label="Failed attempt"
    >
      <span className="h-1 w-1 rounded-full bg-error" />
    </span>
  );
}

function FeaturedReview({
  item,
  meta,
  revenge,
  own,
  onStart,
  onSkip,
}: {
  item: ReviewItem;
  meta: Problem | undefined;
  revenge: RevengeOffer | undefined;
  own: OwnStatus | undefined;
  onStart: () => void;
  onSkip: () => void;
}) {
  const failed = Boolean(revenge) || item.reason === "failed";
  const reason = reasonFor(item, meta, revenge, own);
  const title = meta?.title || revenge?.title || item.problem_slug;
  const topic = meta?.topics?.[0];
  const href = `/practice/${item.problem_slug}`;
  const extra =
    revenge && revenge.failureCount > 1 ? (
      <span className="text-text-tertiary"> · {revenge.failureCount} failed attempts</span>
    ) : null;

  return (
    <article className="relative overflow-hidden rounded-lg border border-hairline bg-surface-raised p-4 transition-colors md:bg-surface md:p-6 md:hover:bg-surface-raised">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-edge-highlight" aria-hidden />

      {/* Desktop header: glyph · No. · title, then difficulty + pattern */}
      <div className="mb-3 hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          {failed ? <FailedGlyph /> : <StatusGlyph status={glyphFor(own, false)} />}
          {meta && (
            <span className="shrink-0 font-mono text-sm text-text-secondary tnum">
              No. {meta.question_id}
            </span>
          )}
          <h3 className="min-w-0 truncate">
            <Link href={href} className="type-title text-text-primary hover:underline">
              {title}
            </Link>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {meta && <DifficultyBadgeNew difficulty={meta.difficulty} className="bg-well" />}
          {topic && (
            <PatternChip label={topic} href={`/patterns/${encodeURIComponent(topic)}`} />
          )}
        </div>
      </div>

      {/* Mobile header: #No · difficulty · pattern, then the title */}
      <div className="space-y-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {meta && (
            <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
              #{meta.question_id}
            </span>
          )}
          {meta && <DifficultyBadgeNew difficulty={meta.difficulty} />}
          {topic && (
            <PatternChip label={topic} href={`/patterns/${encodeURIComponent(topic)}`} />
          )}
        </div>
        <h3 className="pt-0.5">
          <Link
            href={href}
            className="font-display text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary hover:underline"
          >
            {title}
          </Link>
        </h3>
      </div>

      {/* Reason. Desktop: one inline line. Mobile: a recessed callout. */}
      <p className="mb-6 hidden flex-wrap items-center gap-x-2 text-[15px] leading-6 text-text-secondary md:flex">
        <span className={cn("font-medium", reason.urgent ? "text-error" : "text-text-primary")}>
          {reason.label}
        </span>
        {reason.detail && (
          <>
            <span className="text-text-tertiary">·</span>
            <span>
              {reason.detail}
              {extra}
            </span>
          </>
        )}
        {/*
          The queue reasons are rule-based with a fixed gap, not spaced
          repetition — so the UI says "Due for review", never that. The
          low-confidence reason needs a confidence rating that no UI sets.
        */}
      </p>
      <div className="mt-3 flex items-center gap-2.5 rounded-md border border-hairline bg-well p-2.5 md:hidden">
        <RotateCcw className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
        <p className="text-xs font-medium leading-4 text-text-secondary">
          <span className="text-primary">{reason.label}</span>
          {reason.detail && (
            <>
              {" · "}
              {reason.detail}
              {extra}
            </>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2 md:mt-0 md:flex-row md:items-center md:gap-3">
        <Button
          variant="primary"
          onClick={onStart}
          className="h-11 w-full font-semibold md:h-10 md:w-auto md:px-5 md:font-medium"
        >
          <Swords className="hidden h-[18px] w-[18px] md:block" strokeWidth={1.5} aria-hidden />
          {revenge ? "Take revenge" : item.reason === "failed" ? "Retry" : "Revisit"}
          <ArrowRight className="h-[18px] w-[18px] md:hidden" strokeWidth={1.5} aria-hidden />
        </Button>
        <Button variant="ghost" onClick={onSkip} className="h-11 w-full md:h-10 md:w-auto md:px-4">
          Skip for now
        </Button>
      </div>
    </article>
  );
}

function ReviewRow({
  item,
  meta,
  revenge,
  own,
  onStart,
}: {
  item: ReviewItem;
  meta: Problem | undefined;
  revenge: RevengeOffer | undefined;
  own: OwnStatus | undefined;
  onStart: () => void;
}) {
  const reason = reasonFor(item, meta, revenge, own);
  const label = actionLabel(item, revenge, own);
  const topic = meta?.topics?.[0];
  const href = `/practice/${item.problem_slug}`;
  const failed = Boolean(revenge) || item.reason === "failed";
  // The row is a link to the problem; the action starts a battle in place.
  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStart();
  };

  return (
    <>
      {meta && (
        <ProblemRow
          href={href}
          title={meta.title}
          number={`No. ${meta.question_id}`}
          difficulty={meta.difficulty}
          pattern={topic}
          status={glyphFor(own, failed)}
          socialHint={
            <span className="text-text-tertiary">
              <ReasonText reason={reason} />
            </span>
          }
          action={
            <button
              type="button"
              onClick={start}
              className="flex h-8 items-center rounded-xs border border-hairline bg-surface-raised px-3 text-[13px] font-medium leading-5 text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
            >
              {label}
            </button>
          }
          className="hidden md:flex"
        />
      )}

      {/* Mobile card (and the fallback when the catalog row is missing) */}
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3.5 transition-colors hover:bg-surface-raised",
          meta && "md:hidden"
        )}
      >
        <span className="min-w-0 space-y-1">
          {meta && (
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
                #{meta.question_id}
              </span>
              <DifficultyBadgeNew difficulty={meta.difficulty} size="sm" />
              {topic && <PatternChip label={topic} className="min-w-0 truncate" />}
            </span>
          )}
          <span className="block truncate text-sm font-semibold leading-5 text-text-primary">
            {meta?.title || revenge?.title || item.problem_slug}
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium leading-4",
              reason.urgent ? "text-error" : "text-text-secondary"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                reason.urgent ? "bg-error" : "bg-text-secondary"
              )}
              aria-hidden
            />
            <span className="truncate">
              <ReasonText reason={reason} />
            </span>
          </span>
        </span>
        <button
          type="button"
          onClick={start}
          className="flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-raised px-3.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-overlay"
        >
          {label}
        </button>
      </Link>
    </>
  );
}
