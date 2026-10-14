"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Copy } from "lucide-react";
import { getApproachesForProblem } from "@/lib/data/approaches";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getOwnProblemTimeline, getProblemTimeline } from "@/lib/data/problemEvents";
import { getSquadProfiles } from "@/lib/data/profiles";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import {
  buildComparison,
  isComparable,
  differences,
  TECHNIQUE_LABEL,
  CompareRow,
} from "@/lib/approachCompare";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { ErrorCard, EmptyState, Skeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SendChallengeModal } from "@/components/modals/SendChallengeModal";
import type { Approach, Difficulty, Problem, Profile } from "@/types/database";

/**
 * Approach comparison (06): grouped by technique, code collapsed until you
 * explicitly open it. No winners, no scores — differences only.
 */
export default function ComparePage() {
  const params = useParams<{ slug: string }>();
  const slug = (params.slug ?? "").toLowerCase();
  const { user } = useAuth();
  const { startSolving } = useSolving();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [attempted, setAttempted] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const [catalog, rows, timeline] = await Promise.all([
        getCatalogBySlugs([slug]).catch(() => []),
        getApproachesForProblem(slug),
        getOwnProblemTimeline(slug, 1).catch(() => []),
      ]);
      setProblem(catalog[0] ?? null);
      setApproaches(rows);
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
      <div className="max-w-4xl space-y-6" aria-hidden>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl">
        <ErrorCard message={loadError} onRetry={load} />
      </div>
    );
  }

  const title = problem?.title ?? slug;
  const comparison = buildComparison(approaches);
  const allRows = comparison.groups.flatMap((g) => g.rows);
  const diffs = crossGroupDifferences(allRows);
  const selected =
    allRows.find((r) => r.approach.id === selectedId) ?? allRows[0] ?? null;

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
  const openRematch = async () => {
    const target = allRows.find((r) => r.approach.user_id !== user?.id) ?? null;
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

  return (
    <div className="max-w-4xl space-y-8">
      <Link
        href={`/practice/${slug}`}
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-tertiary transition-colors hover:text-text-primary md:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        <span className="truncate">
          Practice / {title} / Compare
        </span>
      </Link>

      <div>
        <h1 className="type-display-md text-text-primary">
          How your squad solved {title}
        </h1>
        <p className="mt-1 text-[15px] leading-6 text-text-secondary">
          {comparison.total} {comparison.total === 1 ? "approach" : "approaches"} ·{" "}
          {comparison.techniqueCount}{" "}
          {comparison.techniqueCount === 1 ? "technique" : "techniques"}
        </p>
        {!attempted && (
          <div className="mt-4">
            <Button variant="secondary" onClick={startBattle} className="min-h-[44px] md:min-h-0">
              Start battle
            </Button>
          </div>
        )}
      </div>

      {!isComparable(comparison.total) ? (
        <EmptyState
          heading={
            comparison.total === 0
              ? "Nobody in your squad has shared an approach yet"
              : "Only one approach so far"
          }
          body={
            comparison.total === 0
              ? "Yours could be the first. Approaches appear here when their author chooses squad or public."
              : "Nothing to compare against yet. Yours could be the second."
          }
          action={
            <Link
              href={`/practice/${slug}#explain`}
              className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover md:min-h-0"
            >
              {comparison.total === 0 ? "Explain your approach" : "Write yours"}
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {diffs.length > 0 && (
            <section aria-labelledby="differ-heading" className="card space-y-2">
              <h2 id="differ-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
                Where they differ
              </h2>
              <ul className="space-y-1.5">
                {diffs.slice(0, 3).map((d, i) => (
                  <li key={i} className="text-sm leading-6 text-text-secondary">
                    {d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Mobile: swipe-sized single card with a jump control. */}
          <div className="space-y-3 md:hidden">
            <SegmentedControl
              label="Approach"
              value={selected?.approach.id ?? ""}
              onChange={(v) => setSelectedId(v)}
              wrap
              options={allRows.map((r) => ({
                value: r.approach.id,
                label: `@${r.approach.author?.username ?? r.approach.author_profile?.username ?? "member"}`,
              }))}
            />
            {selected && (
              <ApproachCard
                key={selected.approach.id}
                row={selected}
                mine={selected.approach.user_id === user?.id}
                attempted={attempted}
                showTechnique
              />
            )}
          </div>

          {/* Desktop: grouped columns by technique. */}
          <div className="hidden space-y-8 md:block">
            {comparison.groups.map((group) => (
              <section key={group.technique} aria-label={group.label} className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-[18px] font-semibold leading-[26px] text-text-primary">
                    {group.label}
                  </h2>
                  <span className="font-mono text-xs text-text-tertiary tnum">
                    {group.rows.length} {group.rows.length === 1 ? "person" : "people"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {group.rows.map((row) => (
                    <ApproachCard
                      key={row.approach.id}
                      row={row}
                      mine={row.approach.user_id === user?.id}
                      attempted={attempted}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="secondary"
              onClick={() => void openRematch()}
              loading={challengeBusy}
              className="min-h-[44px] md:min-h-0"
            >
              {!challengeBusy && "Challenge to a rematch"}
            </Button>
            <Link
              href={`/practice/${slug}`}
              className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
            >
              Back to problem
            </Link>
          </div>
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

function ApproachCard({
  row,
  mine,
  attempted,
  showTechnique = false,
}: {
  row: CompareRow;
  mine: boolean;
  attempted: boolean;
  showTechnique?: boolean;
}) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const a = row.approach;
  const username = a.author?.username ?? a.author_profile?.username ?? "member";
  const lines = a.code ? a.code.split("\n").length : 0;

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
    <article className="card flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Avatar name={username} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium leading-5 text-text-primary">
              {username === "member" ? "A squad mate" : username}
            </span>
            {mine && (
              <span className="inline-flex h-6 items-center rounded-sm border border-hairline-strong px-2 text-xs font-medium leading-4 text-text-secondary">
                You
              </span>
            )}
          </div>
          {showTechnique && (
            <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
              {techniqueLabel(row)}
            </p>
          )}
        </div>
      </div>

      <p className="text-[15px] leading-6 text-text-primary">{a.core_idea}</p>

      {(row.time || row.space) && (
        <p className="font-mono text-sm text-text-secondary tnum">
          {row.time && <span>Time {row.time}</span>}
          {row.time && row.space && <span> · </span>}
          {row.space && <span>Space {row.space}</span>}
        </p>
      )}

      <div className="divide-y divide-hairline border-t border-hairline">
        {a.key_detail && (
          <Disclosure label="Key detail" body={a.key_detail} />
        )}
        {a.edge_cases && (
          <Disclosure label="Edge cases" body={a.edge_cases} />
        )}
        {a.mistakes && (
          <Disclosure label="Mistakes" body={a.mistakes} />
        )}
      </div>

      {a.code ? (
        <div className="rounded-md border border-hairline bg-well p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-text-tertiary tnum">
              {lines} {lines === 1 ? "line" : "lines"}
            </span>
            <div className="flex items-center gap-1">
              {showCode && (
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex h-9 min-h-[44px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
                  aria-label="Copy code"
                >
                  {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              <Button variant="secondary" onClick={() => setShowCode((v) => !v)} className="min-h-[44px] md:min-h-0">
                {showCode ? "Hide code" : "Reveal code"}
              </Button>
            </div>
          </div>
          {!attempted && !showCode && (
            <p className="mt-1 text-xs leading-4 text-text-tertiary">
              You haven&apos;t attempted this yet.
            </p>
          )}
          {showCode && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-4 font-mono text-[14px] leading-[22px] text-text-primary">
              <code>{a.code}</code>
            </pre>
          )}
        </div>
      ) : (
        <p className="text-xs leading-4 text-text-tertiary">
          No code shared with this approach.
        </p>
      )}

      <Link
        href={`/approach/${a.id}`}
        className="text-sm font-medium leading-5 text-text-primary underline decoration-hairline-strong underline-offset-[3px] transition-colors hover:decoration-text-primary"
      >
        Read in full
      </Link>
    </article>
  );
}

function techniqueLabel(row: CompareRow): string {
  return TECHNIQUE_LABEL[row.technique];
}

function Disclosure({ label, body }: { label: string; body: string }) {
  return (
    <details className="group py-2">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0 [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200 group-open:rotate-90"
          strokeWidth={1.5}
        />
      </summary>
      <p className="pb-1 text-sm leading-6 text-text-secondary">{body}</p>
    </details>
  );
}
