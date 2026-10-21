"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ChevronRight, Copy, ExternalLink, Info, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApproachesForProblem } from "@/lib/data/approaches";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getOwnProblemTimeline, getProblemTimeline } from "@/lib/data/problemEvents";
import { getSquadProfiles } from "@/lib/data/profiles";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { daysBetween, formatDuration, relativeDays } from "@/lib/format";
import {
  buildComparison,
  isComparable,
  differences,
  TECHNIQUE_LABEL,
  CompareRow,
} from "@/lib/approachCompare";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { ErrorCard, Skeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { PatternChip } from "@/components/ui/Badge";
import { problemUrl } from "@/components/ui/ProblemLink";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SendChallengeModal } from "@/components/modals/SendChallengeModal";
import type { Approach, Difficulty, Problem, ProblemEvent, Profile } from "@/types/database";

const SOLVE_KINDS = new Set(["solved", "revisited", "challenge_completed"]);

/** Measured facts about an author's own solves of this problem (public event log). */
interface AuthorStat {
  bestSec: number | null;
  verified: boolean;
  lastSolvedAt: string | null;
}

function authorStats(events: ProblemEvent[]): Map<string, AuthorStat> {
  const out = new Map<string, AuthorStat>();
  for (const ev of events) {
    if (!SOLVE_KINDS.has(ev.kind)) continue;
    const cur = out.get(ev.user_id) ?? { bestSec: null, verified: false, lastSolvedAt: null };
    if (typeof ev.duration_sec === "number" && Number.isFinite(ev.duration_sec)) {
      cur.bestSec = cur.bestSec == null ? ev.duration_sec : Math.min(cur.bestSec, ev.duration_sec);
    }
    if ((ev.metadata as { source?: string })?.source === "leetcode") cur.verified = true;
    if (!cur.lastSolvedAt || ev.created_at > cur.lastSolvedAt) cur.lastSolvedAt = ev.created_at;
    out.set(ev.user_id, cur);
  }
  return out;
}

function authorName(a: Approach): string {
  return a.author?.username ?? a.author_profile?.username ?? "member";
}

/**
 * Approach comparison (06): grouped by technique, code collapsed until you
 * explicitly open it. No winners, no scores — differences only. Solve times
 * are shown as facts on each card; nothing ranks one approach above another.
 */
export default function ComparePage() {
  const params = useParams<{ slug: string }>();
  const slug = (params.slug ?? "").toLowerCase();
  const { user } = useAuth();
  const { startSolving } = useSolving();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [slugEvents, setSlugEvents] = useState<ProblemEvent[]>([]);
  const [attempted, setAttempted] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Challenge-to-rematch modal state. The target is the first squad mate with
  // a visible approach; their best measured duration prefills "beat my time".
  // When nothing is measurable, the modal opens with the problem only.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeTargetId, setChallengeTargetId] = useState<string | undefined>(undefined);
  const [challengeBeatSec, setChallengeBeatSec] = useState<number | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalog, rows, timeline, events] = await Promise.all([
        getCatalogBySlugs([slug]).catch(() => []),
        getApproachesForProblem(slug),
        getOwnProblemTimeline(slug, 1).catch(() => []),
        getProblemTimeline(slug).catch(() => [] as ProblemEvent[]),
      ]);
      setProblem(catalog[0] ?? null);
      setApproaches(rows);
      setSlugEvents(events);
      setAttempted(timeline.length > 0);
      setSelectedId(rows[0]?.id ?? null);
      if (rows.length >= 2) {
        track("compare_viewed", { problem_slug: slug, count: rows.length });
      }
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load approaches."));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getSquadProfiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={load} />;
  }

  const title = problem?.title ?? slug;
  const topic = problem?.topics?.[0];
  const comparison = buildComparison(approaches);
  const allRows = comparison.groups.flatMap((g) => g.rows);
  const diffs = crossGroupDifferences(allRows);
  const selected =
    allRows.find((r) => r.approach.id === selectedId) ?? allRows[0] ?? null;
  const selectedIndex = selected ? allRows.indexOf(selected) : 0;
  const stats = authorStats(slugEvents);

  const startBattle = () => {
    startSolving({
      id: problem?.question_id || slug,
      title: problem?.title || slug,
      slug,
      difficulty: problem?.difficulty || "Medium",
      category: problem?.topics?.[0] || "Practice",
    });
  };

  const difficulty: Difficulty = problem?.difficulty || "Medium";

  // The rematch target is the first squad mate with a visible approach — the
  // person whose thinking you just read. Their best measured duration on this
  // problem prefills the time to beat; when nothing is measurable the modal
  // opens with the problem only.
  const firstMate = allRows.find((r) => r.approach.user_id !== user?.id) ?? null;
  const openRematch = async () => {
    const target = firstMate;
    const targetId = target?.approach.user_id;
    if (!targetId) {
      setChallengeTargetId(undefined);
      setChallengeBeatSec(null);
      setChallengeOpen(true);
      return;
    }
    setChallengeBusy(true);
    try {
      const timeline = await getProblemTimeline(slug, targetId).catch(() => []);
      const secs = timeline
        .map((t) => t.duration_sec)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      setChallengeTargetId(targetId);
      setChallengeBeatSec(secs.length > 0 ? Math.min(...secs) : null);
      setChallengeOpen(true);
    } finally {
      setChallengeBusy(false);
    }
  };

  // The modal's recipient picker needs full profiles. If the target is
  // missing from the squad list (stale membership, RLS), append the name the
  // approach already showed so the prefill still points at them.
  const rematchTarget =
    allRows.find((r) => r.approach.user_id === challengeTargetId)?.approach ?? null;
  const rematchTargetName =
    rematchTarget?.author?.username ?? rematchTarget?.author_profile?.username ?? null;
  const modalProfiles: Profile[] =
    challengeTargetId && !profiles.some((p) => p.id === challengeTargetId) && rematchTarget
      ? [
          ...profiles,
          {
            id: challengeTargetId,
            username: rematchTargetName ?? "member",
            leetcode_username: null,
            avatar_url: null,
            active_squad_id: null,
            contest_rating: null,
            global_rank: null,
            streak: 0,
            total_easy: 0,
            total_medium: 0,
            total_hard: 0,
            contest_attended: 0,
            contest_global_rank: null,
            contest_top_percentage: null,
            last_synced_at: null,
            leetcode_session_encrypted: null,
            leetcode_session_synced_at: null,
            created_at: new Date().toISOString(),
          } as Profile,
        ]
      : profiles;

  const handleChallengeSent = () => {
    setChallengeOpen(false);
    setToast("Challenge sent.");
  };

  const firstMateName = firstMate ? authorName(firstMate.approach) : null;
  const rematchLabel =
    firstMateName && firstMateName !== "member"
      ? `Challenge ${firstMateName} to a rematch`
      : "Challenge to a rematch";

  const cardStat = (row: CompareRow) => {
    const s = stats.get(row.approach.user_id) ?? null;
    const caption = s?.lastSolvedAt
      ? `Solved ${relativeDays(daysBetween(s.lastSolvedAt))}`
      : `Shared ${relativeDays(daysBetween(row.approach.created_at))}`;
    return { bestSec: s?.bestSec ?? null, verified: s?.verified ?? false, caption };
  };

  // Mobile swipe track: the segmented control and the scroll position stay in
  // step, so either can be used to move between cards.
  const scrollToCard = (id: string) => {
    setSelectedId(id);
    const el = trackRef.current;
    const i = allRows.findIndex((r) => r.approach.id === id);
    const card = el?.children[i] as HTMLElement | undefined;
    const first = el?.children[0] as HTMLElement | undefined;
    // Offsets are measured from the first card so the track's side padding
    // (which keeps the snap gutter) doesn't skew the target.
    if (el && card && first) el.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior: "smooth" });
  };
  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const base = (el.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const d = Math.abs((c as HTMLElement).offsetLeft - base - el.scrollLeft);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    const id = allRows[best]?.approach.id;
    if (id && id !== selectedId) setSelectedId(id);
  };

  return (
    <div className="space-y-5 md:space-y-8">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary"
      >
        <Link
          href="/practice"
          className="inline-flex min-h-[44px] shrink-0 items-center transition-colors hover:text-text-primary md:min-h-0"
        >
          Practice
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/practice/${slug}`}
          className="inline-flex min-h-[44px] min-w-0 items-center transition-colors hover:text-text-primary md:min-h-0"
        >
          <span className="truncate">{title}</span>
        </Link>
        <span aria-hidden>/</span>
        <span className="shrink-0 text-text-secondary">Compare</span>
      </nav>

      {!attempted && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-tint font-mono text-sm text-primary" aria-hidden>
              !
            </span>
            <div>
              <p className="text-sm font-medium leading-5 text-text-primary">
                You haven&apos;t attempted this problem yet.
              </p>
              <p className="mt-0.5 text-xs leading-[18px] text-text-secondary">
                Squad approaches are open any time. A timed attempt of your own first makes them easier to learn from.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={startBattle}
            className="h-11 shrink-0 border border-hairline text-xs md:h-9"
          >
            Start battle first
          </Button>
        </div>
      )}

      <header className="flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-end md:pb-6">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {problem && (
              <span className="inline-flex h-6 items-center rounded-xs bg-surface-overlay px-2 font-mono text-xs text-text-secondary tnum">
                No. {problem.question_id}
              </span>
            )}
            {topic && <PatternChip label={topic} href={`/patterns/${encodeURIComponent(topic)}`} />}
            {problem && <span className="text-xs text-text-tertiary">· {problem.difficulty}</span>}
          </div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
            How your squad solved {title}
          </h1>
          <p className="mt-1 text-xs leading-5 text-text-secondary md:text-sm">
            <span className="font-mono tnum">{comparison.total}</span>{" "}
            {comparison.total === 1 ? "approach" : "approaches"} ·{" "}
            <span className="font-mono tnum">{comparison.techniqueCount}</span> distinct{" "}
            {comparison.techniqueCount === 1 ? "technique" : "techniques"}
          </p>
        </div>
        <a
          href={problemUrl(slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden h-8 shrink-0 items-center gap-1.5 self-start rounded-sm border border-hairline bg-surface px-3 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:inline-flex md:self-auto"
        >
          View on LeetCode
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </a>
      </header>

      {!isComparable(comparison.total) ? (
        comparison.total === 0 ? (
          <div className="mx-auto max-w-md space-y-4 rounded-lg border border-hairline bg-surface p-6 text-center md:p-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface-overlay text-text-secondary">
              <BookOpen className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-semibold leading-6 text-text-primary">
                Nobody in your squad has shared an approach yet
              </h2>
              <p className="text-sm leading-6 text-text-secondary">
                Yours could be the first. Approaches appear here when their author chooses squad or public.
              </p>
            </div>
            <Link
              href={`/practice/${slug}#explain`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover md:h-10"
            >
              Explain your approach
            </Link>
          </div>
        ) : (
          <SingleApproach row={allRows[0]} mine={allRows[0]?.approach.user_id === user?.id} slug={slug} />
        )
      ) : (
        <div className="space-y-5 md:space-y-8">
          {diffs.length > 0 && (
            <section
              aria-labelledby="differ-heading"
              className="relative overflow-hidden rounded-lg border border-hairline bg-surface p-4 md:p-5"
            >
              <div className="mb-2.5 flex items-center gap-2 md:mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary md:h-2 md:w-2" aria-hidden />
                <h2
                  id="differ-heading"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary md:text-xs"
                >
                  Where they differ
                </h2>
              </div>
              <ul className="space-y-2 text-xs leading-normal text-text-secondary md:text-sm md:leading-relaxed">
                {diffs.slice(0, 3).map((d, i) => (
                  <li key={i} className="flex items-start gap-2 md:gap-2.5">
                    <span className="mt-0.5 font-mono text-[11px] text-primary tnum md:text-xs">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Mobile: a swipe track with a jump control. */}
          <section aria-label="Squad approaches" className="space-y-3 md:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold leading-4 text-text-primary">Squad approaches</span>
              <span className="font-mono text-[11px] text-text-tertiary tnum">
                Card {selectedIndex + 1} of {allRows.length}
              </span>
            </div>
            <SegmentedControl
              label="Approach"
              value={selected?.approach.id ?? ""}
              onChange={scrollToCard}
              // Always wrap: 44px phone tap targets don't fit the fixed-height row.
              wrap
              options={allRows.map((r) => {
                const name = r.approach.user_id === user?.id ? "You" : authorName(r.approach);
                const t = formatDuration(stats.get(r.approach.user_id)?.bestSec);
                return { value: r.approach.id, label: t ? `${name} (${t})` : name };
              })}
            />
            <div
              ref={trackRef}
              onScroll={onTrackScroll}
              className="relative -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {allRows.map((row) => (
                <ApproachCard
                  key={row.approach.id}
                  row={row}
                  mine={row.approach.user_id === user?.id}
                  attempted={attempted}
                  stat={cardStat(row)}
                  showTechnique
                  className="w-[85%] shrink-0 snap-start scroll-ml-4"
                />
              ))}
            </div>
          </section>

          {/* Desktop: grouped columns by technique. */}
          <div className="hidden space-y-8 md:block">
            {comparison.groups.map((group) => (
              <section key={group.technique} aria-label={group.label} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline pb-2.5">
                  <h2 className="text-base font-semibold leading-6 text-text-primary">{group.label}</h2>
                  <span className="inline-flex h-6 items-center rounded-full bg-pattern-tint px-2 font-mono text-xs text-pattern tnum">
                    {group.rows.length} {group.rows.length === 1 ? "person" : "people"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {group.rows.map((row) => (
                    <ApproachCard
                      key={row.approach.id}
                      row={row}
                      mine={row.approach.user_id === user?.id}
                      attempted={attempted}
                      stat={cardStat(row)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="flex flex-col gap-2.5 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:gap-3 md:pt-6">
            <Button
              variant="secondary"
              onClick={() => void openRematch()}
              loading={challengeBusy}
              className="h-11 w-full border border-hairline sm:w-auto md:h-10"
            >
              {!challengeBusy && (
                <>
                  <Zap className="h-4 w-4 text-primary" strokeWidth={1.5} aria-hidden />
                  {rematchLabel}
                </>
              )}
            </Button>
            <Link
              href={`/practice/${slug}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-10"
            >
              <ArrowLeft className="hidden h-4 w-4 sm:block" strokeWidth={1.5} aria-hidden />
              Back to problem
            </Link>
          </footer>
        </div>
      )}
      {challengeOpen && (
        <SendChallengeModal
          profiles={modalProfiles}
          initialTo={challengeTargetId}
          initialProblem={{ slug, title, difficulty }}
          initialBeatSec={challengeBeatSec}
          onClose={() => setChallengeOpen(false)}
          onSent={handleChallengeSent}
        />
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-hairline bg-surface-raised px-4 py-3 text-sm font-medium text-text-primary"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/** Unique, neutral differences across the whole set. */
function crossGroupDifferences(rows: CompareRow[]): string[] {
  const out = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      for (const d of differences(rows[i], rows[j])) out.add(d);
    }
  }
  return Array.from(out).slice(0, 8);
}

/** One shared approach: nothing to compare yet, so say so and point at the next step. */
function SingleApproach({ row, mine, slug }: { row: CompareRow | undefined; mine: boolean; slug: string }) {
  const name = row ? authorName(row.approach) : "member";
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-6">
      <p className="flex items-center gap-2 text-sm leading-5 text-text-secondary">
        <Info className="h-4 w-4 shrink-0 text-pattern" strokeWidth={1.5} aria-hidden />
        {mine
          ? "Only your approach is shared so far."
          : name === "member"
            ? "Only one approach so far."
            : `Only ${name} has shared an approach so far.`}
      </p>
      <p className="text-sm leading-6 text-text-primary">
        {mine
          ? "Nothing to compare against yet. Squad mates' approaches land here when they share them."
          : "Nothing to compare against yet. Yours could be the second."}
      </p>
      {mine ? (
        <Link
          href={`/practice/${slug}`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:h-10"
        >
          Back to problem
        </Link>
      ) : (
        <Link
          href={`/practice/${slug}#explain`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover md:h-10"
        >
          Write yours
        </Link>
      )}
    </div>
  );
}

function ApproachCard({
  row,
  mine,
  attempted,
  stat,
  showTechnique = false,
  className,
}: {
  row: CompareRow;
  mine: boolean;
  attempted: boolean;
  stat: { bestSec: number | null; verified: boolean; caption: string };
  showTechnique?: boolean;
  className?: string;
}) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const a = row.approach;
  const username = authorName(a);
  const displayName = username === "member" ? "A squad mate" : username;
  const lines = a.code ? a.code.split("\n").length : 0;
  const time = formatDuration(stat.bestSec);
  const avatar = a.author?.avatar_url ?? a.author_profile?.avatar_url ?? null;

  const copy = async () => {
    if (!a.code) return;
    try {
      await navigator.clipboard.writeText(a.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col justify-between rounded-lg bg-surface p-4 transition-colors md:p-5",
        mine
          ? "border-2 border-hairline-strong hover:border-text-tertiary"
          : "border border-hairline hover:border-hairline-strong",
        className
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3 md:pb-4">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <Avatar name={displayName} src={avatar} size="md" className="md:h-10 md:w-10 md:text-sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <h3 className="truncate text-xs font-semibold leading-4 text-text-primary md:text-sm md:leading-5">
                  {displayName}
                </h3>
                {mine && (
                  <span className="inline-flex h-5 items-center rounded-xs border border-primary/20 bg-primary-tint px-1.5 font-mono text-[11px] font-medium text-primary">
                    You
                  </span>
                )}
                {stat.verified && (
                  <span
                    className="inline-flex h-5 items-center gap-1 rounded-xs border border-verified/20 bg-verified-tint px-1.5 text-[11px] font-medium text-verified"
                    title="Solve matched an accepted LeetCode submission"
                  >
                    <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
                    <span className="hidden md:inline">Verified</span>
                    <span className="sr-only md:hidden">Verified</span>
                  </span>
                )}
              </div>
              <p className="truncate font-mono text-[10px] leading-4 text-text-tertiary md:text-xs">
                {showTechnique ? TECHNIQUE_LABEL[row.technique] : stat.caption}
              </p>
            </div>
          </div>
          {time && (
            <div className="shrink-0 text-right font-mono text-base font-semibold leading-6 text-text-primary tnum md:text-xl md:leading-7">
              {time}
            </div>
          )}
        </div>

        <div className="border-b border-hairline py-3 md:py-4">
          <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary md:mb-1.5 md:text-[11px]">
            Core idea
          </p>
          <p className="text-xs leading-normal text-text-primary md:text-sm">“{a.core_idea}”</p>
        </div>

        {(row.time || row.space) && (
          <p className="flex items-center justify-between gap-4 border-b border-hairline py-2 font-mono text-xs tnum md:justify-start md:py-3">
            {row.time && (
              <span>
                <span className="text-text-tertiary">Time: </span>
                <span className="font-medium text-text-primary">{row.time}</span>
              </span>
            )}
            {row.time && row.space && (
              <span aria-hidden className="hidden text-hairline-strong md:inline">
                ·
              </span>
            )}
            {row.space && (
              <span>
                <span className="text-text-tertiary">Space: </span>
                <span className="font-medium text-text-primary">{row.space}</span>
              </span>
            )}
          </p>
        )}

        {(a.key_detail || a.edge_cases || a.mistakes) && (
          <div className="space-y-1.5 py-3 text-xs md:space-y-2">
            {a.key_detail && <Disclosure label="Key detail" body={a.key_detail} />}
            {a.edge_cases && <Disclosure label="Edge cases handled" body={a.edge_cases} />}
            {a.mistakes && <Disclosure label="Mistakes & retries" body={a.mistakes} />}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-hairline pt-3 md:mt-4 md:pt-4">
        {a.code ? (
          showCode ? (
            <div className="overflow-hidden rounded-md border border-hairline bg-well">
              <div className="flex items-center justify-between gap-2 border-b border-hairline bg-surface px-3 py-1 font-mono text-xs text-text-tertiary">
                <span className="tnum">
                  {lines} {lines === 1 ? "line" : "lines"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex h-11 items-center gap-1 rounded-sm px-2 text-[11px] transition-colors hover:text-text-primary md:h-7"
                    aria-label="Copy code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCode(false)}
                    className="inline-flex h-11 items-center rounded-sm px-2 text-[11px] transition-colors hover:text-text-primary md:h-7"
                  >
                    Hide
                  </button>
                </div>
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs leading-5 text-text-secondary">
                <code>
                  {a.code.split("\n").map((line, i) => (
                    <span key={i} className="block whitespace-pre">
                      <span className="mr-3 inline-block w-5 select-none text-right text-text-tertiary tnum">
                        {i + 1}
                      </span>
                      {line}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 md:rounded-md md:border md:border-hairline md:bg-well md:p-3">
              <div className="min-w-0 space-y-0.5">
                <div className="font-mono text-xs text-text-tertiary tnum md:text-text-secondary">
                  {lines} {lines === 1 ? "line" : "lines"}
                </div>
                {!attempted && (
                  <div className="text-[11px] leading-4 text-primary">You haven&apos;t attempted this yet.</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCode(true)}
                className="inline-flex h-11 shrink-0 items-center rounded-sm border border-hairline bg-surface-overlay px-3 text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] md:h-8"
              >
                Reveal code
              </button>
            </div>
          )
        ) : (
          <p className="text-xs leading-4 text-text-tertiary">No code shared with this approach.</p>
        )}
        <Link
          href={`/approach/${a.id}`}
          className="mt-2 inline-flex min-h-[44px] items-center gap-0.5 text-xs font-medium leading-4 text-text-secondary transition-colors hover:text-text-primary md:mt-3 md:min-h-0"
        >
          Read in full
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function Disclosure({ label, body }: { label: string; body: string }) {
  return (
    <details className="group rounded-xs border border-hairline bg-well">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-medium text-text-secondary transition-colors hover:text-text-primary md:min-h-0 [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform duration-200 group-open:rotate-90"
          strokeWidth={1.5}
        />
      </summary>
      <p className="border-t border-hairline px-3 pb-2.5 pt-1.5 leading-relaxed text-text-secondary">{body}</p>
    </details>
  );
}
