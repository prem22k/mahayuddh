"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCheck,
  Clock,
  ExternalLink,
  Flame,
  Gauge,
  RefreshCw,
  Shapes,
  ShieldCheck,
  Swords,
  TrendingUp,
  User,
} from "lucide-react";
import { syncErrorMessage } from "@/lib/syncError";
import { getPublicProfile, syncUserProfileStats } from "@/lib/data/profiles";
import {
  getLeaderboard,
  getPreviousSnapshotRanks,
  rankChangeLabel,
  snapshotRanks,
  type BoardRow,
} from "@/lib/data/leaderboard";
import {
  isWindowed,
  metricUnit,
  rankingBasis,
  type LeaderboardMetric,
  type LeaderboardWindow,
} from "@/lib/leaderboardLabels";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConnectLeetCodeModal } from "@/components/modals/ConnectLeetCodeModal";
import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";
import { BoardRowsSkeleton } from "@/components/skeletons/LeaderboardSkeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FilterChips } from "@/components/ui/ProblemRow";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { getSquadName } from "@/lib/data/squadActivity";
import { dataErrorMessage } from "@/lib/data/errors";
import { cn } from "@/lib/utils";
import {
  boardActionCls,
  boardListCls,
  boardRankCls,
  boardRowCls,
} from "@/components/leaderboard/rowStyles";
import { useCachedQuery, useInvalidate } from "@/lib/cache/query";
import {
  oneOf,
  parseBool,
  parseNonNegativeInt,
  parseString,
  useStoredState,
} from "@/hooks/useStoredState";

const PAGE = 25;
const LONG_BOARD = 8;

const METRIC_IDS: readonly LeaderboardMetric[] = [
  "verified",
  "solves",
  "streak",
  "hard",
  "rating",
  "improved",
  "pattern",
];

const METRIC_LABELS: Record<LeaderboardMetric, string> = {
  verified: "Verified solves",
  solves: "Solves",
  streak: "Streak",
  hard: "Hard solved",
  rating: "Contest rating",
  improved: "Most improved",
  pattern: "By pattern",
};

const METRIC_OPTIONS = METRIC_IDS.map((id) => METRIC_LABELS[id]);
const METRIC_BY_LABEL = Object.fromEntries(
  METRIC_IDS.map((id) => [METRIC_LABELS[id], id])
) as Record<string, LeaderboardMetric>;

function deltaTone(label: string): string {
  if (label.startsWith("↑")) return "text-verified";
  if (label.startsWith("↓")) return "text-error";
  if (label === "New") return "text-text-secondary";
  return "text-text-disabled md:text-text-tertiary";
}

const parseTab = oneOf(["squad", "global"] as const);
const parseMetric = oneOf(METRIC_IDS);
const parseWindow = oneOf<LeaderboardWindow>(["week", "month", "all"]);

const NO_ROWS: BoardRow[] = [];
const NO_COUNTS = new Map<string, number>();

export default function LeaderboardPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const invalidate = useInvalidate();

  // The board opens the way it was left: tab, metric, window and filters are
  // remembered in this browser.
  const [chosenTab, storeTab] = useStoredState<"squad" | "global">("mahayuddh_lb_tab", "squad", parseTab);
  const [pickedTab, setPickedTab] = useState(false);
  const [metric, storeMetric] = useStoredState<LeaderboardMetric>("mahayuddh_lb_metric", "verified", parseMetric);
  const [timeWindow, storeWindow] = useStoredState<LeaderboardWindow>("mahayuddh_lb_window", "week", parseWindow);
  const [hideUnconnected, setHideUnconnected] = useStoredState("mahayuddh_lb_linked_only", false, parseBool);
  const [appliedPattern, storeAppliedPattern] = useStoredState("mahayuddh_lb_pattern", "", parseString);
  const [patternDraft, setPatternDraft] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Connect handle input state
  const [inputHandle, setInputHandle] = useState("");
  const [isConnectingHandle, setIsConnectingHandle] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const squadId = profile?.active_squad_id ?? null;
  // A squadless visitor gets Global as soon as the profile is known, not after
  // the board loads, so the Squad tab never flips under a loaded board. Their
  // saved choice is kept for when they join one, and tapping Squad still shows
  // the "join a squad" prompt.
  const tab = !authLoading && !squadId && !pickedTab ? "global" : chosenTab;
  // The page is kept for this browser tab only: back from a profile lands on
  // the same page, a new visit starts at the top. Any change of board (tab or
  // filter) starts at the top too.
  const [page, setPage] = useStoredState("mahayuddh_lb_page", 0, parseNonNegativeInt, "session");
  const setTab = (next: "squad" | "global") => {
    setPickedTab(true);
    if (next !== tab) setPage(0);
    storeTab(next);
  };

  const patternInput = patternDraft ?? appliedPattern;
  const pattern = metric === "pattern" && appliedPattern.trim() ? appliedPattern.trim() : null;
  // "By pattern" with nothing entered yet asks for a pattern rather than
  // reporting that nobody has solved one.
  const awaitingPattern = metric === "pattern" && !appliedPattern.trim();
  const boardReady = !awaitingPattern && (tab !== "squad" || !!squadId);

  // Both tabs read the same SQL board, so every visible filter actually ranks.
  const boardQuery = useCachedQuery(
    boardReady
      ? ["leaderboard", tab, tab === "squad" ? squadId : null, metric, timeWindow, pattern, hideUnconnected, page]
      : null,
    () =>
      getLeaderboard({
        scope: tab,
        metric,
        window: timeWindow,
        pattern,
        linkedOnly: hideUnconnected,
        limit: PAGE,
        offset: page * PAGE,
      })
  );

  const rows = boardQuery.data?.rows ?? NO_ROWS;
  const total = boardQuery.data?.total ?? 0;
  const hasNext = (page + 1) * PAGE < total;
  const loading = boardQuery.isLoading;
  const error =
    boardQuery.error && boardQuery.data === undefined
      ? dataErrorMessage(boardQuery.error, "Couldn't load the leaderboard.")
      : null;

  // The viewer's own row comes from the same board, so the sticky bar can say
  // their rank even when they are pages away from it.
  const selfReady = !!user && !awaitingPattern && (tab !== "squad" || !!squadId);
  const selfQuery = useCachedQuery(
    selfReady
      ? ["leaderboard-self", tab, tab === "squad" ? squadId : null, metric, timeWindow, pattern, hideUnconnected]
      : null,
    () =>
      getLeaderboard({
        scope: tab,
        metric,
        window: timeWindow,
        pattern,
        linkedOnly: hideUnconnected,
        onlyUser: user?.id ?? null,
        limit: 1,
      })
  );
  const selfRow = selfQuery.data?.rows[0] ?? null;

  // A remembered page past the end (people left the board since) steps back to
  // the first page instead of showing an empty board with no way out.
  useEffect(() => {
    if (page > 0 && boardQuery.data && rows.length === 0) setPage(0);
  }, [page, boardQuery.data, rows.length, setPage]);

  const squadNameQuery = useCachedQuery(
    squadId ? ["squad-name", squadId] : null,
    () => getSquadName(squadId as string)
  );
  const squadName = squadNameQuery.data ?? null;

  const inspectedQuery = useCachedQuery(
    inspectedId ? ["public-profile", inspectedId] : null,
    () => getPublicProfile(inspectedId as string)
  );
  const inspectedProfile = inspectedQuery.data ?? null;

  const handleSyncMyStats = async () => {
    if (!user || !profile?.leetcode_username) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    setConnectError(null);

    try {
      const synced = await syncUserProfileStats(user.id, profile.leetcode_username);
      if (!synced) {
        setConnectError("Could not sync LeetCode stats. Check the handle and try again.");
        return;
      }
      await refreshProfile();
      // Either tab, plus the viewer's own row, can move after a sync.
      await invalidate("leaderboard", "leaderboard-self", "my-statuses");
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to sync:", e);
      const msg =
        e instanceof Response
          ? await syncErrorMessage(e, "Could not sync LeetCode stats. Please try again.")
          : "Could not sync LeetCode stats. Please try again.";
      setConnectError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputHandle.trim()) return;
    setIsConnectingHandle(true);
    setConnectError(null);

    try {
      const updated = await syncUserProfileStats(user.id, inputHandle.trim());
      if (updated) {
        await refreshProfile();
        await invalidate("leaderboard", "leaderboard-self", "my-statuses");
        setInputHandle("");
      } else {
        setConnectError("Could not find LeetCode account. Check username spelling.");
      }
    } catch (e) {
      console.error("Failed to connect handle:", e);
      const msg =
        e instanceof Response
          ? await syncErrorMessage(e, "Sync failed. Please try again.")
          : "Sync failed. Please try again.";
      setConnectError(msg);
    } finally {
      setIsConnectingHandle(false);
    }
  };

  const changeMetric = (next: LeaderboardMetric) => {
    if (next === metric) return;
    storeMetric(next);
    setPage(0);
  };

  const changeWindow = (next: LeaderboardWindow) => {
    if (next === timeWindow) return;
    storeWindow(next);
    setPage(0);
  };

  const applyPattern = () => {
    storeAppliedPattern(patternInput.trim());
    setPatternDraft(null);
    setPage(0);
  };

  // Snapshot identity: squad views are per-squad (ranks would collide across
  // squads under a bare "squad"), and each metric/window/pattern is its own
  // history.
  const scopeKey = tab === "squad" && squadId ? `squad:${squadId}` : "global";
  // The snapshot route only accepts [a-z0-9:_-], so the pattern goes in as a slug.
  const patternSlug = (pattern ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  const snapshotMetric =
    metric === "pattern" ? `${metric}:${timeWindow}:${patternSlug}` : `${metric}:${timeWindow}`;

  // Movement compares this page against the latest frozen board. A failed read
  // leaves the column honestly at "—".
  const pageIdsKey = rows.map((r) => r.user_id).sort().join(",");
  const prevRanksQuery = useCachedQuery(
    tab === "squad" && rows.length > 0
      ? ["previous-snapshot-ranks", scopeKey, snapshotMetric, pageIdsKey]
      : null,
    () => {
      const ids = pageIdsKey.split(",").filter(Boolean);
      return getPreviousSnapshotRanks(scopeKey, snapshotMetric, ids);
    }
  );
  const prevRanks = prevRanksQuery.data?.ranks ?? NO_COUNTS;
  const prevReadOk = prevRanksQuery.data !== undefined;
  const prevDate = prevRanksQuery.data?.snapshotDate ?? null;

  // Freeze the whole squad board once it fits on this first page. A failed
  // write leaves the movement column without a comparison, which is honest.
  useEffect(() => {
    if (tab !== "squad" || page !== 0 || hasNext || rows.length === 0) return;
    void snapshotRanks(
      scopeKey,
      snapshotMetric,
      rows.map((row) => ({ user_id: row.user_id, rank: row.rank, value: row.value ?? 0 }))
    );
  }, [tab, page, hasNext, rows, scopeKey, snapshotMetric]);

  // Each metric's glyph shows on phones (Stitch mobile chips); on desktop only
  // the selected chip carries its glyph.
  const metricLeading: Record<LeaderboardMetric, React.ReactNode> = {
    verified: <span className="h-1.5 w-1.5 rounded-full bg-verified" />,
    solves: <CheckCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />,
    streak: <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />,
    hard: <span className="h-1.5 w-1.5 rounded-full bg-error" />,
    rating: <TrendingUp className="h-3.5 w-3.5 text-pattern" strokeWidth={1.5} />,
    improved: <Gauge className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} />,
    pattern: <Shapes className="h-3.5 w-3.5 text-pattern" strokeWidth={1.5} />,
  };
  const leading = Object.fromEntries(
    METRIC_IDS.map((id) => [
      METRIC_LABELS[id],
      <span key={id} aria-hidden className={cn("inline-flex", id !== metric && "md:hidden")}>
        {metricLeading[id]}
      </span>,
    ])
  );

  return (
    <div className="mx-auto flex w-full max-w-reading flex-col">
      <div className="flex items-center justify-between gap-4 pb-4 md:pb-6">
        <h1 className="type-display-md text-text-primary max-md:text-2xl max-md:leading-[29px] max-md:tracking-[-0.015em]">
          Leaderboard
        </h1>
        <SegmentedControl
          label="Squad or global standings"
          value={tab}
          onChange={setTab}
          className="max-md:h-auto [&>button]:whitespace-nowrap"
          options={[
            { value: "squad", label: "Squad", title: "Your active squad" },
            { value: "global", label: "Global", title: "Everyone" },
          ]}
        />
      </div>

      {/* The same controls rank both boards now: the server applies them all. */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-4 md:pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterChips
            options={METRIC_OPTIONS}
            value={METRIC_LABELS[metric]}
            onChange={(label) => {
              const next = METRIC_BY_LABEL[label];
              if (next) changeMetric(next);
            }}
            leading={leading}
            scroll
            label="Rank by"
          />
          {isWindowed(metric) && (
            <div className="flex items-center justify-between gap-3 md:shrink-0">
              <span className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary md:hidden">
                <Clock className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Time window
              </span>
              <SegmentedControl
                label="Time window"
                value={timeWindow}
                onChange={changeWindow}
                className="max-md:h-auto [&>button]:whitespace-nowrap"
                options={[
                  { value: "week", label: "Last 7 days" },
                  { value: "month", label: "Last 30 days" },
                  { value: "all", label: "All time" },
                ]}
              />
            </div>
          )}
        </div>

        {metric === "pattern" && (
          <div className="flex items-center gap-2">
            <input
              value={patternInput}
              onChange={(e) => {
                setPatternDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPattern();
              }}
              aria-label="Pattern to rank by, for example Graphs"
              placeholder="Pattern, e.g. Graphs"
              className="h-10 min-h-[44px] min-w-0 flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-hidden md:min-h-0 md:max-w-xs"
            />
            <Button
              variant="secondary"
              onClick={applyPattern}
              className="min-h-[44px] md:min-h-0"
            >
              Apply
            </Button>
          </div>
        )}

        {/* The ranking basis is stated, always. */}
        <p className="text-xs leading-5 text-text-tertiary">
          {rankingBasis(metric, timeWindow, appliedPattern)}
        </p>
      </div>

      <div aria-live="polite" className="sr-only">
        Ranked by {METRIC_LABELS[metric]}; {total} {tab === "squad" ? "squad members" : "people"}.
      </div>

      <div className="mt-4 md:mt-6">
        {tab === "squad" && !squadId ? (
          <EmptyState
            heading="No squad members here yet"
            body="Join or create a squad, this tab ranks people you practice with."
            action={
              <Link
                href="/squad"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
              >
                Go to squad
              </Link>
            }
          />
        ) : awaitingPattern ? (
          <div className="rounded-lg border border-hairline bg-surface p-10 text-center">
            <p className="text-sm leading-6 text-text-secondary">
              Type a pattern, for example Graphs or Dynamic Programming, and press Apply.
            </p>
          </div>
        ) : loading ? (
          <BoardRowsSkeleton />
        ) : error ? (
          <ErrorCard message={error} onRetry={() => void boardQuery.refresh()} />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-hairline bg-surface p-10 text-center">
            <p className="text-sm leading-6 text-text-secondary">
              {tab === "squad"
                ? "Nobody in your squad has anything recorded for this yet."
                : "Nobody has anything recorded for this yet."}
              {isWindowed(metric) && timeWindow !== "all" && " Try a longer time window."}
            </p>
          </div>
        ) : (
          <div className="relative">
            <ol className={boardListCls}>
              {rows.map((row) => {
                const isCurrentUser = row.user_id === user?.id;
                const unit = metricUnit(metric, timeWindow, row.leetcode_verified, appliedPattern);
                const noValue = row.value == null;
                const delta = rankChangeLabel(prevRanks.get(row.user_id), row.rank, prevReadOk);
                return (
                  <li
                    key={row.user_id}
                    aria-label={`${row.username}, rank ${row.rank}`}
                    className={boardRowCls(isCurrentUser)}
                  >
                    <span
                      className={cn(
                        boardRankCls(row.rank),
                        isCurrentUser && "max-md:font-semibold max-md:text-text-primary"
                      )}
                    >
                      {row.rank}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectedId(row.user_id)}
                      aria-label={`Open ${row.username}'s dossier`}
                      className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left md:gap-4"
                    >
                      <Avatar
                        name={row.username}
                        src={row.avatar_url}
                        size="md"
                        className={isCurrentUser ? "ring-1 ring-primary/40" : undefined}
                      />
                      <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                          <span className={cn("truncate text-sm font-semibold text-text-primary", isCurrentUser && "shrink-0")}>
                            {row.username}
                            {isCurrentUser && <span className="hidden md:inline"> (you)</span>}
                          </span>
                          {isCurrentUser && (
                            <span className="shrink-0 rounded-xs border border-hairline bg-primary-tint px-1.5 text-[10px] font-medium uppercase leading-4 text-primary md:hidden">
                              You
                            </span>
                          )}
                          {isCurrentUser && squadName && (
                            <span className="hidden min-w-0 truncate rounded-xs border border-hairline bg-primary-tint px-1.5 py-0.5 font-mono text-xs font-medium tracking-[0.06em] text-primary/80 md:inline-block">
                              {squadName}
                            </span>
                          )}
                        </span>
                        {row.leetcode_username && (
                          <span
                            className={cn(
                              "flex min-w-0 items-center gap-1 font-mono text-xs leading-4 text-text-tertiary",
                              isCurrentUser && "md:hidden"
                            )}
                          >
                            <span className="truncate">@{row.leetcode_username}</span>
                            {row.leetcode_verified ? (
                              <span
                                role="img"
                                aria-label="Verified LeetCode owner"
                                title="Verified LeetCode owner"
                                className="inline-flex shrink-0"
                              >
                                <BadgeCheck className="h-3 w-3 text-verified" strokeWidth={1.5} aria-hidden />
                              </span>
                            ) : (
                              // No visible label: on a narrow row it would squeeze the
                              // handle to "@". The check mark is the signal; the
                              // dossier and profile say "unverified" in words.
                              <span className="sr-only">, not verified</span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex shrink-0 flex-col items-end gap-0.5 md:flex-row md:items-center md:gap-4">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-sm font-medium text-text-primary tnum md:text-lg md:font-semibold">
                          {noValue ? "—" : row.value}
                        </span>
                        {!noValue && (
                          <>
                            <span className="font-mono text-sm text-text-primary md:hidden">{unit.short}</span>
                            <span className="hidden font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary md:inline">
                              {unit.long}
                            </span>
                          </>
                        )}
                      </span>
                      {tab === "squad" && (
                        <span
                          className={cn(
                            "font-mono text-xs font-medium leading-none tnum md:w-8 md:text-center md:text-sm md:leading-5",
                            deltaTone(delta)
                          )}
                          title={
                            prevDate
                              ? `Rank change since ${prevDate}`
                              : prevReadOk
                                ? "First snapshot: no prior rank yet"
                                : "No movement data yet"
                          }
                        >
                          {delta}
                        </span>
                      )}
                    </div>

                    <div className="hidden shrink-0 items-center justify-end gap-1.5 md:flex md:w-[144px]">
                      <button
                        type="button"
                        onClick={() => setInspectedId(row.user_id)}
                        className={cn(
                          boardActionCls,
                          isCurrentUser
                            ? "px-3 text-text-primary"
                            : "md:opacity-0 md:focus-visible:opacity-100 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                        )}
                      >
                        Dossier
                      </button>
                      {!isCurrentUser && (
                        <Link href={`/challenges?to=${row.user_id}`} className={cn(boardActionCls, "px-3")}>
                          Challenge
                        </Link>
                      )}
                    </div>

                    {isCurrentUser ? (
                      <button
                        type="button"
                        onClick={() => setInspectedId(row.user_id)}
                        aria-label="Open your dossier"
                        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-primary hover:bg-well md:hidden"
                      >
                        <User className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    ) : (
                      <Link
                        href={`/challenges?to=${row.user_id}`}
                        aria-label={`Challenge ${row.username}`}
                        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-raised hover:text-text-primary md:hidden"
                      >
                        <Swords className="h-4 w-4" strokeWidth={1.5} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* The pinned row covers short boards; long ones keep a sticky "you" bar. */}
            {selfRow && total > LONG_BOARD && (
              <div className="sticky bottom-4 mt-4 flex items-center gap-3 rounded-lg border border-hairline-strong bg-surface-overlay p-4">
                <Avatar name={selfRow.username} src={selfRow.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    You · #{selfRow.rank}
                  </p>
                  <p className="truncate font-mono text-xs text-text-secondary tnum">
                    {selfRow.value == null
                      ? "—"
                      : `${selfRow.value} ${metricUnit(metric, timeWindow, selfRow.leetcode_verified, appliedPattern).long}`}
                  </p>
                </div>
                {profile?.leetcode_username && (
                  <a
                    href={`https://leetcode.com/${profile.leetcode_username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <span className="hidden sm:inline">LeetCode</span>
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!error && boardReady && (page > 0 || hasNext) && (
        <div className="flex items-center justify-between gap-2 pt-3">
          <Button
            variant="ghost"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="min-h-[44px] border border-hairline md:min-h-0"
          >
            ← Previous
          </Button>
          <span className="font-mono text-xs text-text-tertiary tnum">Page {page + 1}</span>
          <Button
            variant="ghost"
            onClick={() => setPage(page + 1)}
            disabled={!hasNext}
            className="min-h-[44px] border border-hairline md:min-h-0"
          >
            Next →
          </Button>
        </div>
      )}

      {/* LeetCode-linked controls: the filter and the sync actions travel together. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          aria-pressed={hideUnconnected}
          onClick={() => {
            setHideUnconnected(!hideUnconnected);
            setPage(0);
          }}
          className="flex min-h-[44px] items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary aria-pressed:border-hairline-strong aria-pressed:bg-surface-overlay aria-pressed:text-text-primary md:h-9 md:min-h-0"
          title="Hide members without a linked LeetCode handle"
        >
          Linked only
        </button>
        {profile?.leetcode_username && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncMyStats}
              disabled={isSyncing}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-60 md:h-9 md:min-h-0"
            >
              <RefreshCw className={isSyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={1.5} />
              {syncSuccess ? "Synced" : isSyncing ? "Syncing…" : "Sync stats"}
            </button>
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className="flex min-h-[44px] items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-9 md:min-h-0"
            >
              Full history
            </button>
          </div>
        )}
        {profile?.leetcode_username && connectError && (
          <p role="alert" className="w-full text-xs text-error">
            {connectError}
          </p>
        )}
      </div>

      {/* Below the board, not above it: the card depends on the profile, which
          lands after the board skeleton is drawn, so above it pushed the
          rankings down. No profile yet while auth resolves; don't flash it. */}
      {!authLoading && !profile?.leetcode_username && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:mt-8 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              Connect LeetCode to appear here
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Optional. Adds contest rating and verified solves, you are already on the board without it.
            </p>
          </div>
          <form onSubmit={handleConnectHandle} className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Your LeetCode username"
              value={inputHandle}
              onChange={(e) => setInputHandle(e.target.value)}
              placeholder="Your LeetCode username"
              className="h-10 min-h-[44px] min-w-0 flex-1 rounded-md border border-hairline bg-well px-3.5 font-mono text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-hidden md:min-h-0 md:w-52 md:flex-none"
              required
            />
            <Button type="submit" variant="secondary" loading={isConnectingHandle} disabled={!inputHandle.trim()}>
              Connect
            </Button>
          </form>
          {connectError && <p className="text-sm text-error">{connectError}</p>}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2.5 rounded-md border border-hairline bg-well p-3 md:mt-8 md:justify-center md:border-0 md:bg-transparent md:p-0 md:text-center">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary md:hidden" strokeWidth={1.5} aria-hidden />
        <p className="text-xs font-medium leading-5 text-text-tertiary">
          Verified solves come from LeetCode sync. Streak, hard solved and contest rating are current values, so the time window applies only to the others.
        </p>
      </div>

      <UserStatsDossierModal
        isOpen={!!inspectedId && !!inspectedProfile}
        onClose={() => setInspectedId(null)}
        profile={inspectedProfile}
      />

      <ConnectLeetCodeModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={async () => {
          await refreshProfile();
          await invalidate("leaderboard", "leaderboard-self", "my-statuses");
        }}
      />
    </div>
  );
}
