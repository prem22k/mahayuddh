"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ExternalLink,
  LifeBuoy,
  Medal,
  PenLine,
  Play,
  RotateCcw,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  getSquadMembers,
  getSquadName,
  getTodaySlugTimes,
  getSolvedToday,
  getSquadStreak,
  getMemberWeekGrid,
  getOwnFailedAttempt,
  getFirstIncomingChallenge,
  type SquadActivityMember,
  type SquadStreak,
  type TodaySlugTime,
  type IncomingChallenge,
  type OwnFailedAttempt,
} from "@/lib/data/squadActivity";
import { getAllProblems, getUserStatusesBySlugs, toStatusMap } from "@/lib/data/sheets";
import { getIncomingSuggestionCount } from "@/lib/data/suggestions";
import { getActiveGoalPattern, getSquadMemberIds, getSlugSquadActivity } from "@/lib/data/squads";
import { getRecentFeed } from "@/lib/data/feed";
import { getOpenReviews } from "@/lib/data/review";
import { getActiveGoals, computeGoalProgress, GoalProgress } from "@/lib/data/goals";
import { getBattlesForSlug } from "@/lib/data/battles";
import { getProblemHistory, cacheDailyBattle } from "@/lib/data/dailyBattles";
import { pickDailyBattle, formatDuration, ProblemHistory } from "@/lib/dailyBattle";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving, useSolvingTimer } from "@/components/providers/SolvingProvider";
import { Pass } from "@/components/pass/Pass";
import { Button } from "@/components/ui/Button";
import { VerifiedBadge, SelfReportedBadge } from "@/components/ui/Badge";
import { ErrorCard } from "@/components/ui/States";
import { ArenaSkeleton } from "@/components/skeletons/ArenaSkeleton";
import {
  ARENA_PASS_CLASS,
  ARENA_STUB_CLASS,
  ArenaStub,
  InProgressChip,
  PassBadges,
  PassTitle,
  PassUnavailable,
  UnavailableStub,
  SquadSolvedLine,
  WhyThisOne,
} from "@/components/arena/ArenaPass";
import { UpNextCard } from "@/components/arena/UpNextCard";
import { SquadFeed } from "@/components/arena/SquadFeed";
import {
  ChallengeLoop,
  GoalLoop,
  RailHeading,
  RailNote,
  ReviewLoop,
  StreakLoop,
  SyncRow,
} from "@/components/arena/WaitingOnYou";
import { parseProblemStatusEvent, applyStatusChange } from "@/lib/problemStatusEvent";
import { ListProblem, TriState, FeedEvent } from "@/types/database";
import { useCachedQuery } from "@/lib/cache/query";

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Ranking for the up-next shelf: Easy first, then Medium, then Hard.
const DIFFICULTY_RANK: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };

function relDayLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** "4m ago" for the rail's sync line; null when the account never synced. */
function syncAgo(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** True when the member logged a solve on the newest (today's) grid column. */
function solvedTodayIn(grid: Record<string, boolean[]>, id: string): boolean {
  const row = grid[id];
  return row && row.length > 0 ? row[row.length - 1] === true : false;
}

// Stable empty values: a fresh [] or {} per render would re-run every memo.
const NO_PROBLEMS: ListProblem[] = [];
const NO_STATUSES: Record<string, TriState> = {};
const NO_STRINGS: string[] = [];
const NO_FEED: FeedEvent[] = [];
const NO_HISTORY = new Map<string, ProblemHistory>();
const NO_MEMBERS: SquadActivityMember[] = [];
const NO_TIMES: Record<string, TodaySlugTime> = {};
const NO_IDS = new Set<string>();
const NO_GRID: Record<string, boolean[]> = {};

export default function ArenaPage() {
  const router = useRouter();
  const { profile, user, refreshProfile, loading: authLoading } = useAuth();
  const { activeProblem, startSolving } = useSolving();
  const { seconds } = useSolvingTimer();
  void refreshProfile;
  const userId = user?.id ?? null;
  const squadId = profile?.active_squad_id ?? null;

  // Every read below goes through the client cache (lib/cache/query.tsx): a
  // revisit renders from cache at once and refreshes in the background; the
  // skeleton only shows on the very first load.

  // The catalog is shared with every page that lists problems.
  const allProblems = useCachedQuery(["all-problems"], getAllProblems, { freshForMs: 10 * 60_000 });
  const myStatuses = useCachedQuery(userId ? ["my-statuses"] : null, async () =>
    toStatusMap(await getUserStatusesBySlugs(userId as string))
  );
  const problems = allProblems.data ?? NO_PROBLEMS;
  const statusMap = myStatuses.data ?? NO_STATUSES;
  const loading = allProblems.isLoading || myStatuses.isLoading;
  const loadError =
    allProblems.error || myStatuses.error ? "Couldn't load today's battle. Try again." : null;
  const handleRetryLoad = () => {
    void allProblems.refresh();
    void myStatuses.refresh();
  };

  const incomingCount =
    useCachedQuery(userId ? ["incoming-suggestion-count"] : null, () =>
      getIncomingSuggestionCount(userId as string)
    ).data ?? 0;
  const reviewReasons =
    useCachedQuery(userId ? ["open-reviews"] : null, async () =>
      (await getOpenReviews()).map((x) => x.reason)
    ).data ?? NO_STRINGS;

  const squadInfo = useCachedQuery(squadId ? ["home-squad", squadId] : null, async () => {
    const sid = squadId as string;
    const [goalPattern, memberIds, feed, goals] = await Promise.all([
      getActiveGoalPattern(sid).catch(() => null),
      getSquadMemberIds(sid).catch(() => NO_STRINGS),
      getRecentFeed({ squadId: sid, limit: 3 }).catch(() => NO_FEED),
      getActiveGoals(sid).catch(() => [] as Awaited<ReturnType<typeof getActiveGoals>>),
    ]);
    let goal: GoalProgress | null = null;
    if (goals.length > 0) {
      try {
        const { getSquadDetail } = await import("@/lib/data/squads");
        const detail = await getSquadDetail(sid);
        goal = await computeGoalProgress(goals[0], detail.members).catch(() => null);
      } catch {
        goal = null;
      }
    }
    return { goalPattern, memberIds, feed, goal };
  });
  const goalPattern = squadInfo.data?.goalPattern ?? null;
  const squadMemberIds = squadInfo.data?.memberIds ?? NO_STRINGS;
  const feed = squadInfo.data?.feed ?? NO_FEED;
  const goal = squadInfo.data?.goal ?? null;

  // A solve anywhere in the app updates the cached statuses in place.
  const setMyStatuses = myStatuses.setData;
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const parsed = parseProblemStatusEvent(e);
      if (!parsed) return;
      void setMyStatuses((current) => applyStatusChange(current ?? {}, parsed.slug, parsed.status));
    };
    window.addEventListener("problem-status-changed", handleStatusChange);
    return () => window.removeEventListener("problem-status-changed", handleStatusChange);
  }, [setMyStatuses]);

  // Daily pick history (failure-rate signals need events, not just status).
  const historyQuery = useCachedQuery(
    userId && problems.length > 0 ? ["problem-history", problems.length] : null,
    () => getProblemHistory(problems.map((p) => p.title_slug))
  );
  const history = !userId ? NO_HISTORY : (historyQuery.data ?? null);

  const computed = useMemo(
    () =>
      problems.length === 0
        ? null
        : pickDailyBattle({
            problems,
            statusMap,
            userId: user?.id ?? undefined,
            squadSlugs: undefined,
            goalPattern,
            history: history ?? undefined,
          }),
    [problems, statusMap, user, goalPattern, history]
  );

  const memberKey = squadMemberIds.join(",");
  const activity =
    useCachedQuery(
      computed && squadMemberIds.length > 0
        ? ["slug-squad-activity", computed.problem.title_slug, memberKey]
        : null,
      () => getSlugSquadActivity(computed?.problem.title_slug as string, squadMemberIds)
    ).data ?? null;

  // Squad activity from problem_events: fastest times, solves, streak, grid.
  // No pick (the problem list failed or is empty): the rail still needs the
  // squad, streak and grid, so only the pick-specific reads are skipped.
  const activitySlug = computed?.problem.title_slug?.toLowerCase() ?? null;
  const squadActivity = useCachedQuery(
    squadId && squadMemberIds.length > 0 ? ["home-squad-activity", squadId, activitySlug, memberKey] : null,
    async () => {
      const sid = squadId as string;
      const [members, name, times, solved, streak, grid] = await Promise.all([
        getSquadMembers(sid),
        getSquadName(sid).catch(() => null),
        activitySlug ? getTodaySlugTimes(activitySlug, squadMemberIds) : Promise.resolve({} as Record<string, TodaySlugTime>),
        activitySlug ? getSolvedToday(activitySlug, squadMemberIds) : Promise.resolve(new Set<string>()),
        getSquadStreak(squadMemberIds),
        getMemberWeekGrid(squadMemberIds, 7),
      ]);
      return { members, name, times, solved, streak, grid };
    }
  );
  const squadMembers = squadActivity.data?.members ?? NO_MEMBERS;
  const squadName = squadActivity.data?.name ?? null;
  const todayTimes = squadActivity.data?.times ?? NO_TIMES;
  const solvedTodayIds = squadActivity.data?.solved ?? NO_IDS;
  const squadStreak = squadActivity.data?.streak ?? null;
  const weekGrid = squadActivity.data?.grid ?? NO_GRID;
  const activityError = squadActivity.error ? "Couldn't load squad activity. Try again." : null;
  const retryActivity = squadActivity.refresh;

  // Up next (Wave D first-run): the easiest unsolved starter, never today's
  // pick and never a Hard wall for a new user. Falls back to the easiest
  // overall when everything is solved, and to Two Sum before lists load.
  const upNextList = useMemo(() => {
    const pick = computed?.problem.title_slug?.toLowerCase() ?? null;
    const withoutPick = problems.filter((p) => p.title_slug.toLowerCase() !== pick);
    const unsolved = withoutPick.filter(
      (p) => statusMap[p.title_slug.toLowerCase()] !== "solved"
    );
    const easiestFirst = (rows: ListProblem[]) =>
      [...rows].sort(
        (a, b) =>
          (DIFFICULTY_RANK[a.difficulty] ?? 1) - (DIFFICULTY_RANK[b.difficulty] ?? 1) ||
          a.order_index - b.order_index
      );
    const list = (unsolved.length > 0 ? easiestFirst(unsolved) : easiestFirst(withoutPick)).slice(0, 5);
    if (list.length > 0) return list;
    return [
      {
        id: "fallback-two-sum",
        list_id: "fallback",
        title: "Two Sum",
        title_slug: "two-sum",
        difficulty: "Easy",
        category: "Arrays & Hashing",
        order_index: 1,
      } as ListProblem,
    ];
  }, [problems, statusMap, computed?.problem.title_slug]);
  const [upNextIndex, setUpNextIndex] = useState(0);
  const upNext = upNextList[upNextIndex % upNextList.length] ?? null;
  const upNextSlug = (upNext?.title_slug ?? "two-sum").toLowerCase();
  const upNextTitle = upNext?.title ?? "Two Sum";
  const upNextDifficulty = upNext?.difficulty ?? "Easy";
  const upNextPattern = upNext?.category ?? "Arrays & Hashing";
  const upNextNo = upNext ? `No. ${upNext.order_index}` : "No. 1";

  // Caller's most recent failed attempt on the up-next problem (revenge line).
  const failedAttempt =
    useCachedQuery(userId ? ["own-failed-attempt", upNextSlug] : null, () => getOwnFailedAttempt(upNextSlug))
      .data ?? null;

  // Oldest open challenge addressed to the caller.
  const incoming = useCachedQuery(userId ? ["first-incoming-challenge"] : null, () =>
    getFirstIncomingChallenge(userId as string)
  );
  const incomingChallenge = incoming.data ?? null;
  const incomingLoaded = userId != null && (incoming.data !== undefined || incoming.error != null);

  useEffect(() => {
    if (computed && user?.id) {
      cacheDailyBattle(user.id, { ...computed, squadContext: profile?.active_squad_id ? activity : null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed?.problem.title_slug, user?.id]);

  // Resolved battle facts. Only real rows: with no pick the Pass renders an
  // honest error/empty card instead (see pickUnavailable below).
  const pickSlug = computed?.problem.title_slug?.toLowerCase() ?? "";
  const pickTitle = computed?.problem.title ?? "";
  const pickDifficulty = computed?.problem.difficulty ?? "";
  const pickPattern = computed?.problem.category ?? "";
  const pickNo = computed?.problem.order_index != null ? String(computed.problem.order_index) : "";
  const reasons = computed?.why ?? [];

  const solvedToday = pickSlug ? statusMap[pickSlug] === "solved" : false;

  const lastSolveSec =
    useCachedQuery(solvedToday && pickSlug ? ["last-solve-sec", pickSlug] : null, async () => {
      const rows = await getBattlesForSlug(pickSlug, 20);
      const secs = rows
        .filter((b) => b.outcome === "solved" && b.duration_sec != null)
        .map((b) => b.duration_sec as number);
      return secs.length ? Math.min(...secs) : null;
    }).data ?? null;

  const isRunningThis = !!pickSlug && activeProblem?.slug?.toLowerCase() === pickSlug;

  const hasSquad = squadId !== null && squadMemberIds.length > 0;
  const memberById = useMemo(
    () => new Map(squadMembers.map((m) => [m.id, m] as const)),
    [squadMembers]
  );
  const solvedCount = solvedTodayIds.size;
  const fastestEntry = useMemo(() => {
    let best: { id: string; bestSec: number } | null = null;
    for (const [id, t] of Object.entries(todayTimes)) {
      if (t.bestSec == null) continue;
      if (!best || t.bestSec < best.bestSec) best = { id, bestSec: t.bestSec };
    }
    return best;
  }, [todayTimes]);
  const fastestTimeLabel = fastestEntry ? (formatDuration(fastestEntry.bestSec) ?? "") : "";
  const fastestHandle = fastestEntry
    ? `@${memberById.get(fastestEntry.id)?.username ?? "teammate"}`
    : "";
  const fastest =
    fastestEntry && fastestTimeLabel
      ? {
          time: fastestTimeLabel,
          handle: fastestHandle,
          verified: todayTimes[fastestEntry.id]?.verified ?? false,
        }
      : null;
  const solvers = squadMembers.filter((m) => solvedTodayIds.has(m.id));
  // Avatars: today's solvers of the pick; the squad when nobody has yet.
  const avatarPeople = (solvers.length > 0 ? solvers : squadMembers)
    .slice(0, 3)
    .map((m) => ({ name: m.username, src: m.avatar_url }));
  // Streak card reads the streak's own signal (any solve today, squad-local
  // day) from the week grid, not today's pick.
  const callerSolvedToday = user ? solvedTodayIn(weekGrid, user.id) : false;
  const streakMembers = squadMembers.map((m) => ({
    id: m.id,
    name: m.username,
    solved: solvedTodayIn(weekGrid, m.id),
  }));
  const streakAlive =
    hasSquad && streakMembers.length > 0 && streakMembers.every((m) => m.solved);
  const rankedToday = useMemo(
    () =>
      Object.entries(todayTimes)
        .map(([id, t]) => ({ id, bestSec: t.bestSec }))
        .filter((r): r is { id: string; bestSec: number } => r.bestSec != null)
        .sort((a, b) => a.bestSec - b.bestSec),
    [todayTimes]
  );
  const callerRank = user ? rankedToday.findIndex((r) => r.id === user.id) + 1 : 0;
  const rankLine =
    callerRank === 1
      ? "Fastest in your squad today"
      : callerRank === 2
        ? "Second fastest in your squad today"
        : callerRank === 3
          ? "Third fastest in your squad today"
          : callerRank > 3
            ? `#${callerRank} fastest in your squad today`
            : "Solved today";
  const callerVerified = user ? (todayTimes[user.id]?.verified ?? false) : false;
  const heroTime =
    lastSolveSec != null ? (formatDuration(lastSolveSec) ?? "Solved") : "Solved";
  const challengeTime = lastSolveSec != null ? formatDuration(lastSolveSec) : null;
  const revengeLabel =
    failedAttempt?.durationSec != null ? formatDuration(failedAttempt.durationSec) : null;
  const revenge = failedAttempt
    ? { time: revengeLabel, when: failedAttempt.when ? relDayLabel(failedAttempt.when) : null }
    : null;
  const challengeDue =
    incomingChallenge?.dueAt != null
      ? new Date(incomingChallenge.dueAt).toLocaleDateString(undefined, { weekday: "short" })
      : null;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const stubNow = new Date();
  const stubDate = `${String(stubNow.getDate()).padStart(2, "0")} ${stubNow.toLocaleDateString(undefined, { month: "short" }).toUpperCase()} ${stubNow.getFullYear()}`;
  const reviewCount = reviewReasons.length;
  // One per rail card that is actually waiting on the caller.
  const openLoops = !incomingLoaded
    ? null
    : (incomingChallenge ? 1 : 0) +
      (hasSquad && squadStreak != null && !callerSolvedToday ? 1 : 0) +
      (goal && goal.remaining > 0 ? 1 : 0) +
      (reviewCount > 0 ? 1 : 0);

  const handleStart = () => {
    if (!computed) return;
    startSolving({
      id: computed.problem.order_index,
      title: pickTitle,
      slug: pickSlug,
      difficulty: pickDifficulty,
      category: pickPattern,
      // The solving happens in the LeetCode tab opened below, so the timer
      // keeps running while this tab is hidden (see SolvingProvider).
      openedOnLeetCode: true,
    });
    window.open(`https://leetcode.com/problems/${pickSlug}/`, "_blank", "noopener");
  };

  if (loading || authLoading) return <ArenaSkeleton />;

  const stub = (
    <ArenaStub
      serial={pickNo}
      expiry={stubDate}
      faction={hasSquad ? squadName : null}
      squad={
        hasSquad && squadMembers.length > 0
          ? {
              solved: solvedCount,
              total: squadMemberIds.length,
              people: squadMembers.map((m) => ({
                name: m.username,
                done: solvedTodayIds.has(m.id),
              })),
            }
          : null
      }
    />
  );

  return (
    <div className="flex flex-col gap-6 select-none md:gap-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="type-display-md text-text-primary">Arena</h1>
          {hasSquad && squadName && (
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-text-tertiary md:hidden">
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="truncate">{squadName}</span>
            </span>
          )}
        </div>
        <p className="text-[13px] leading-5 text-text-secondary md:text-[15px] md:leading-6">
          {todayLabel} · <span className="max-md:text-text-tertiary">New pick at midnight</span>
        </p>
      </div>

      {/* With no pick the Pass itself carries the error; otherwise a later
          step of the load failed and the banner stays. */}
      {loadError && computed && (
        <ErrorCard message={loadError} onRetry={handleRetryLoad} />
      )}

      {/* Phone/tablet order: pass, waiting on you, up next, squad. Desktop: a
          focal column with the rail beside it. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="contents lg:col-span-8 lg:flex lg:min-w-0 lg:flex-col lg:gap-8">
          {!computed ? (
            <Pass
              className={`order-1 ${ARENA_PASS_CLASS}`}
              stubClassName={ARENA_STUB_CLASS}
              body={
                loadError ? (
                  <PassUnavailable
                    title="Today's pick couldn't load"
                    body="The problem list didn't come through, so there's nothing to pick from yet. Check your connection and retry."
                    action={
                      <Button variant="secondary" className="h-11 border border-hairline" onClick={handleRetryLoad}>
                        <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        Retry
                      </Button>
                    }
                  />
                ) : (
                  <PassUnavailable
                    title="No pick today"
                    body="Your sheets have no problems to pick from yet."
                    action={
                      <Button
                        variant="secondary"
                        className="h-11 border border-hairline"
                        onClick={() => {
                          router.push("/practice");
                        }}
                      >
                        Open Practice
                      </Button>
                    }
                  />
                )
              }
              stub={<UnavailableStub expiry={stubDate} />}
            />
          ) : solvedToday ? (
            <Pass
              className={`order-1 ${ARENA_PASS_CLASS}`}
              stubClassName={ARENA_STUB_CLASS}
              body={
                <div className="flex flex-col gap-5 md:gap-6">
                  <div className="flex flex-col gap-3">
                    <PassBadges
                      difficulty={pickDifficulty}
                      pattern={pickPattern}
                      no={pickNo}
                      leading={callerVerified ? <VerifiedBadge /> : <SelfReportedBadge />}
                    />
                    <PassTitle>{pickTitle}</PassTitle>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="type-mono-display text-text-primary tnum max-md:text-[40px] max-md:leading-10">
                        {heroTime}
                      </span>
                      <span
                        className={
                          callerRank > 0
                            ? "inline-flex items-center gap-1 text-xs font-medium text-verified"
                            : "text-xs font-medium text-text-secondary"
                        }
                      >
                        {callerRank > 0 && <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
                        {rankLine}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <Button
                      variant="secondary"
                      className="h-11 border border-hairline"
                      onClick={() => {
                        router.push(`/practice/${pickSlug}#explain`);
                      }}
                    >
                      <PenLine className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      Explain your approach
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 border border-hairline"
                      onClick={() => {
                        router.push(`/challenges?problem=${pickSlug}&title=${encodeURIComponent(pickTitle)}`);
                      }}
                    >
                      <Medal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      {challengeTime ? `Challenge a teammate to beat ${challengeTime}` : "Challenge a teammate"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-11"
                      onClick={() => {
                        router.push(`/practice/${pickSlug}/compare`);
                      }}
                    >
                      <ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      Compare with your squad
                    </Button>
                  </div>
                </div>
              }
              stub={stub}
            />
          ) : isRunningThis ? (
            <Pass
              className={`order-1 ${ARENA_PASS_CLASS}`}
              stubClassName={ARENA_STUB_CLASS}
              body={
                <div className="flex flex-col gap-5 md:gap-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <InProgressChip clock={fmtClock(seconds)} />
                      <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
                        No. {pickNo}
                      </span>
                    </div>
                    <PassTitle>{pickTitle}</PassTitle>
                    {fastest && (
                      <p className="rounded-md border border-hairline bg-well p-3 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary">
                        Benchmark to beat:{" "}
                        <span className={fastest.verified ? "text-verified" : "text-text-primary"}>
                          {fastest.time}
                        </span>{" "}
                        ({fastest.handle})
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full font-semibold md:w-auto"
                      onClick={() => {
                        router.push(`/practice/${pickSlug}`);
                      }}
                    >
                      <Play className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Resume
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-12 w-full border border-hairline md:w-auto"
                      onClick={() => {
                        router.push("/stuck");
                      }}
                    >
                      <LifeBuoy className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      Stuck?
                    </Button>
                  </div>
                </div>
              }
              stub={stub}
            />
          ) : (
            <Pass
              className={`order-1 ${ARENA_PASS_CLASS}`}
              stubClassName={ARENA_STUB_CLASS}
              body={
                <div className="flex flex-col gap-4 md:gap-6">
                  <div className="flex flex-col gap-3">
                    <PassBadges difficulty={pickDifficulty} pattern={pickPattern} no={pickNo} />
                    <PassTitle>{pickTitle}</PassTitle>
                    <WhyThisOne reasons={reasons} />
                  </div>
                  <SquadSolvedLine
                    hasSquad={hasSquad}
                    avatars={avatarPeople}
                    solverNames={solvers.map((m) => m.username)}
                    fastest={fastest}
                  />
                  <div className="flex flex-col gap-1 pt-1 md:flex-row md:items-center md:gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full font-semibold md:w-auto"
                      onClick={handleStart}
                    >
                      <Swords className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                      Start battle
                    </Button>
                    <a
                      href={`https://leetcode.com/problems/${pickSlug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-4 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-12 md:text-sm"
                    >
                      Open on LeetCode
                      <ExternalLink className="h-4 w-4 max-md:h-3.5 max-md:w-3.5 max-md:text-text-tertiary" strokeWidth={1.5} aria-hidden />
                    </a>
                  </div>
                </div>
              }
              stub={stub}
            />
          )}

          <UpNextCard
            className="order-3"
            slug={upNextSlug}
            title={upNextTitle}
            no={upNextNo}
            difficulty={upNextDifficulty}
            pattern={upNextPattern}
            revenge={revenge}
            hint={`Easiest unsolved starter${upNextList.length > 1 ? " — skip any time" : ""}.`}
            canSkip={upNextList.length > 1}
            onStart={() =>
              startSolving({
                id: upNext?.order_index ?? 1,
                title: upNextTitle,
                slug: upNextSlug,
                difficulty: upNextDifficulty,
                category: upNextPattern,
              })
            }
            onSkip={() => setUpNextIndex((i) => i + 1)}
          />

          <SquadFeed className="order-4" events={feed.slice(0, 3)} />
        </div>

        {/* Rail */}
        <aside className="order-2 flex min-w-0 flex-col gap-2.5 lg:col-span-4 lg:gap-3" aria-label="Waiting on you">
          <RailHeading openLoops={openLoops} />

          <div className="flex flex-col gap-2 lg:gap-3">
            {activityError && (
              <ErrorCard message={activityError} onRetry={() => void retryActivity()} />
            )}

            <ChallengeLoop
              loaded={incomingLoaded}
              waiting={incomingCount}
              challenge={
                incomingChallenge
                  ? {
                      fromName: incomingChallenge.fromName,
                      fromAvatar: incomingChallenge.fromAvatar,
                      problemTitle: incomingChallenge.problemTitle,
                      difficulty: incomingChallenge.difficulty,
                      beat:
                        incomingChallenge.beatSec != null
                          ? formatDuration(incomingChallenge.beatSec)
                          : null,
                      due: challengeDue,
                    }
                  : null
              }
            />

            <StreakLoop
              hasSquad={hasSquad}
              days={squadStreak ? squadStreak.days : null}
              alive={streakAlive}
              error={activityError != null}
              members={streakMembers}
              callerId={user?.id ?? null}
              callerSolved={callerSolvedToday}
            />

            <GoalLoop
              goal={
                goal
                  ? {
                      title: goal.goal.title,
                      done: goal.done,
                      target: goal.target,
                      pct: goal.pct,
                      daysRemaining: goal.daysRemaining,
                      participants: goal.participants,
                      memberCount: goal.memberCount,
                    }
                  : null
              }
            />

            <ReviewLoop reasons={reviewReasons} />

            <SyncRow syncedAgo={syncAgo(profile?.last_synced_at ?? null)} />

            {!hasSquad && (
              <RailNote
                title="Practicing solo"
                body="Invite your people to start the streak."
                action={
                  <Button variant="ghost" className="min-h-[44px] px-0 hover:bg-transparent" onClick={() => router.push("/squad")}>
                    Invite
                  </Button>
                }
              />
            )}
            {!profile?.last_synced_at && (
              <RailNote
                body="Connect LeetCode to verify your solves."
                action={
                  <Button variant="ghost" className="min-h-[44px] px-0 hover:bg-transparent" onClick={() => router.push("/squad")}>
                    Connect LeetCode
                  </Button>
                }
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
