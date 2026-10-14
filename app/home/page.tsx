"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ExternalLink, ChevronRight } from "lucide-react";
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
import { getAllLists, getAllProblems, getUserStatusesBySlugs, toStatusMap } from "@/lib/data/sheets";
import { getPendingSuggestionCount, getIncomingSuggestionCount } from "@/lib/data/suggestions";
import { getCatalogTopicsSummary, getCatalogCount } from "@/lib/data/problems";
import { getActiveGoalPattern, getSquadMemberIds, getSlugSquadActivity } from "@/lib/data/squads";
import { getRecentFeed } from "@/lib/data/feed";
import { getOpenReviews } from "@/lib/data/review";
import { getActiveGoals, computeGoalProgress, GoalProgress } from "@/lib/data/goals";
import { getBattlesForSlug } from "@/lib/data/battles";
import { getProblemHistory, cacheDailyBattle } from "@/lib/data/dailyBattles";
import { pickDailyBattle, formatDuration, ProblemHistory } from "@/lib/dailyBattle";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving, useSolvingTimer } from "@/components/providers/SolvingProvider";
import { Pass, PassSerial } from "@/components/pass/Pass";
import { Button } from "@/components/ui/Button";
import {
  VerifiedBadge,
  SelfReportedBadge,
  DifficultyBadgeNew,
  PatternChip,
  StreakChip,
} from "@/components/ui/Badge";
import { AvatarStack } from "@/components/ui/Avatar";
import { ProblemRow } from "@/components/ui/ProblemRow";
import { Skeleton, ErrorCard } from "@/components/ui/States";
import { parseProblemStatusEvent, applyStatusChange } from "@/lib/problemStatusEvent";
import { CustomList, ListProblem, TriState, FeedEvent } from "@/types/database";

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

function syncLabel(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  return `Synced ${Math.floor(hrs / 24)}d ago`;
}

export default function ArenaPage() {
  const { profile, user, refreshProfile } = useAuth();
  const { activeProblem, startSolving } = useSolving();
  const { seconds } = useSolvingTimer();
  void refreshProfile;
  const [squadMembers, setSquadMembers] = useState<SquadActivityMember[]>([]);
  const [todayTimes, setTodayTimes] = useState<Record<string, TodaySlugTime>>({});
  const [solvedTodayIds, setSolvedTodayIds] = useState<Set<string>>(new Set());
  const [squadStreak, setSquadStreak] = useState<SquadStreak | null>(null);
  const [weekGrid, setWeekGrid] = useState<Record<string, boolean[]>>({});
  const [failedAttempt, setFailedAttempt] = useState<OwnFailedAttempt | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [incomingLoaded, setIncomingLoaded] = useState(false);
  const [squadName, setSquadName] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [incomingCount, setIncomingCount] = useState(0);
  void lists;
  void suggestionsCount;
  const [catalogCount, setCatalogCount] = useState(0);
  void catalogCount;
  const [loading, setLoading] = useState(true);

  const [topics, setTopics] = useState<{ topic: string; count: number; solved: number; attempted: number }[]>([]);
  void topics;
  const [statusMap, setStatusMap] = useState<Record<string, TriState>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goalPattern, setGoalPattern] = useState<string | null>(null);
  const [squadMemberIds, setSquadMemberIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Arena-specific projections (all derived, never invented).
  const [history, setHistory] = useState<Map<string, ProblemHistory> | null>(null);
  const [activity, setActivity] = useState<{ attempted: number; total: number } | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [goal, setGoal] = useState<GoalProgress | null>(null);
  const [lastSolveSec, setLastSolveSec] = useState<number | null>(null);
  const [showReasons, setShowReasons] = useState(false);

  useEffect(() => {
    async function loadArenaData() {
      try {
        const [listsData, problemsData, pendingCount, userStatuses, totalCatalog] =
          await Promise.all([
            getAllLists(),
            getAllProblems(),
            getPendingSuggestionCount(),
            user ? getUserStatusesBySlugs(user.id) : Promise.resolve([]),
            getCatalogCount(),
          ]);
        setLists(listsData);
        setProblems(problemsData);
        setSuggestionsCount(pendingCount);
        setCatalogCount(totalCatalog);
        const userMap = toStatusMap(userStatuses);
        setStatusMap(userMap);
        setLoadError(null);
        setTopics(await getCatalogTopicsSummary(userMap));
        if (user) {
          getIncomingSuggestionCount(user.id).then(setIncomingCount).catch(() => setIncomingCount(0));
          getOpenReviews().then((r) => setReviewCount(r.length)).catch(() => setReviewCount(0));
        }
        if (profile?.active_squad_id) {
          getActiveGoalPattern(profile.active_squad_id)
            .then(setGoalPattern)
            .catch(() => setGoalPattern(null));
          getSquadMemberIds(profile.active_squad_id)
            .then(setSquadMemberIds)
            .catch(() => setSquadMemberIds([]));
          getRecentFeed({ squadId: profile.active_squad_id, limit: 3 })
            .then(setFeed)
            .catch(() => setFeed([]));
          getActiveGoals(profile.active_squad_id)
            .then(async (goals) => {
              if (goals.length === 0) {
                setGoal(null);
                return;
              }
              try {
                const { getSquadDetail } = await import("@/lib/data/squads");
                const detail = await getSquadDetail(profile.active_squad_id as string);
                const p = await computeGoalProgress(goals[0], detail.members).catch(() => null);
                setGoal(p);
              } catch {
                setGoal(null);
              }
            })
            .catch(() => setGoal(null));
        } else {
          setGoalPattern(null);
          setSquadMemberIds([]);
          setFeed([]);
          setGoal(null);
        }
      } catch (err) {
        console.error("Error loading Arena data:", err);
        setLoadError("Couldn't load today's battle. Try again.");
      } finally {
        setLoading(false);
      }
    }
    loadArenaData();
  }, [user, refreshKey, profile?.active_squad_id]);

  const handleRetryLoad = () => {
    setLoadError(null);
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const parsed = parseProblemStatusEvent(e);
      if (!parsed) return;
      const next = applyStatusChange(statusMap, parsed.slug, parsed.status);
      setStatusMap(next);
      getCatalogTopicsSummary(next).then(setTopics).catch(() => {});
    };
    window.addEventListener("problem-status-changed", handleStatusChange);
    return () => window.removeEventListener("problem-status-changed", handleStatusChange);
  }, [statusMap]);

  // Daily pick history (failure-rate signals need events, not just status).
  useEffect(() => {
    if (!user) {
      setHistory(new Map());
      return;
    }
    getProblemHistory(problems.map((p) => p.title_slug))
      .then(setHistory)
      .catch(() => setHistory(new Map()));
  }, [user, problems]);

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

  useEffect(() => {
    const slug = computed?.problem.title_slug;
    if (!slug || squadMemberIds.length === 0) {
      setActivity(null);
      return;
    }
    getSlugSquadActivity(slug, squadMemberIds)
      .then(setActivity)
      .catch(() => setActivity(null));
  }, [computed?.problem.title_slug, squadMemberIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const squadId = profile?.active_squad_id ?? null;
  const memberKey = squadMemberIds.join(",");

  // Squad activity from problem_events: fastest times, solves, streak, grid.
  useEffect(() => {
    const slug = (computed?.problem.title_slug ?? "coin-change-ii").toLowerCase();
    if (!squadId || squadMemberIds.length === 0) {
      setSquadMembers([]);
      setSquadName(null);
      setTodayTimes({});
      setSolvedTodayIds(new Set());
      setSquadStreak(null);
      setWeekGrid({});
      setActivityError(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      getSquadMembers(squadId),
      getSquadName(squadId).catch(() => null),
      getTodaySlugTimes(slug, squadMemberIds),
      getSolvedToday(slug, squadMemberIds),
      getSquadStreak(squadMemberIds),
      getMemberWeekGrid(squadMemberIds, 7),
    ])
      .then(([members, name, times, solved, streak, grid]) => {
        if (cancelled) return;
        setSquadMembers(members);
        setSquadName(name);
        setTodayTimes(times);
        setSolvedTodayIds(solved);
        setSquadStreak(streak);
        setWeekGrid(grid);
        setActivityError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setActivityError("Couldn't load squad activity. Try again.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, computed?.problem.title_slug, memberKey, activityRefreshKey]);

  // Up next (Wave D first-run): the easiest unsolved starter, never today's
  // pick and never a Hard wall for a new user. Falls back to the easiest
  // overall when everything is solved, and to Two Sum before lists load.
  const upNextList = useMemo(() => {
    const withoutPick = problems.filter(
      (p) => p.title_slug.toLowerCase() !== (computed?.problem.title_slug ?? "coin-change-ii").toLowerCase()
    );
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
  useEffect(() => {
    if (!user) {
      setFailedAttempt(null);
      return;
    }
    let cancelled = false;
    getOwnFailedAttempt(upNextSlug)
      .then((r) => {
        if (!cancelled) setFailedAttempt(r);
      })
      .catch(() => {
        if (!cancelled) setFailedAttempt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, upNextSlug]);

  // Oldest open challenge addressed to the caller.
  useEffect(() => {
    if (!user) {
      setIncomingChallenge(null);
      setIncomingLoaded(false);
      return;
    }
    let cancelled = false;
    getFirstIncomingChallenge(user.id)
      .then((c) => {
        if (cancelled) return;
        setIncomingChallenge(c);
        setIncomingLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIncomingLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (computed && user?.id) {
      cacheDailyBattle(user.id, { ...computed, squadContext: profile?.active_squad_id ? activity : null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed?.problem.title_slug, user?.id]);

  // Resolved battle facts. Spec content is the fallback; real rows win.
  const pickSlug = (computed?.problem.title_slug ?? "coin-change-ii").toLowerCase();
  const pickTitle = computed?.problem.title ?? "Coin Change II";
  const pickDifficulty = computed?.problem.difficulty ?? "Medium";
  const pickPattern = computed?.problem.category ?? goalPattern ?? "Dynamic programming";
  const pickNo =
    computed?.problem.order_index != null ? String(computed.problem.order_index) : "518";
  const reasons = computed?.why && computed.why.length > 0 ? computed.why : ["Unsolved in NeetCode 150", "Matches your squad goal pattern"];
  const reasonCount = reasons.length;

  const solvedToday = pickSlug ? statusMap[pickSlug] === "solved" : false;

  useEffect(() => {
    if (!solvedToday || !pickSlug) {
      setLastSolveSec(null);
      return;
    }
    getBattlesForSlug(pickSlug, 20)
      .then((rows) => {
        const secs = rows
          .filter((b) => b.outcome === "solved" && b.duration_sec != null)
          .map((b) => b.duration_sec as number);
        setLastSolveSec(secs.length ? Math.min(...secs) : null);
      })
      .catch(() => setLastSolveSec(null));
  }, [solvedToday, pickSlug]);

  const isRunningThis = activeProblem?.slug?.toLowerCase() === pickSlug;

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
  const fastestLine =
    fastestEntry && fastestTimeLabel
      ? `fastest ${fastestTimeLabel} by ${fastestHandle}`
      : solvedCount > 0
        ? `${solvedCount} solved today`
        : "No solves yet today";
  const solvedNames = squadMembers
    .filter((m) => solvedTodayIds.has(m.id))
    .map((m) => m.username);
  const socialNames = !hasSquad
    ? "Practicing solo — invite your squad to start the streak"
    : solvedNames.length === 0
      ? "No one in your squad has solved this yet"
      : solvedNames.length === 1
        ? `${solvedNames[0]} solved it`
        : solvedNames.length === 2
          ? `${solvedNames[0]} and ${solvedNames[1]} solved it`
          : `${solvedNames[0]}, ${solvedNames[1]} and ${solvedNames.length - 2} more solved it`;
  const avatarPeople = squadMembers
    .slice(0, 3)
    .map((m) => ({ name: m.username, src: m.avatar_url }));
  const unsolvedLabels = squadMembers
    .filter((m) => !solvedTodayIds.has(m.id))
    .map((m) => (user && m.id === user.id ? "you" : m.username.split(" ")[0]));
  const streakSub = activityError
    ? "Couldn't load today's solves"
    : !hasSquad
      ? "Solo practice — no squad streak yet"
      : squadStreak == null
        ? "Loading streak…"
        : unsolvedLabels.length === 0
          ? `${solvedCount} of ${squadMemberIds.length} solved today · everyone solved`
          : `${solvedCount} of ${squadMemberIds.length} solved today · ${unsolvedLabels.slice(0, 2).join(" and ")} haven't`;
  const weekAllSolved = useMemo(
    () =>
      squadMemberIds.length === 0
        ? []
        : Array.from({ length: 7 }, (_, i) =>
            squadMemberIds.every((id) => weekGrid[id]?.[i] ?? false)
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekGrid, memberKey]
  );
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
  const revengeLine = !failedAttempt
    ? null
    : revengeLabel
      ? `Revenge available · you stopped at ${revengeLabel}${failedAttempt.when ? ` · ${relDayLabel(failedAttempt.when)}` : ""}`
      : `Revenge available${failedAttempt.when ? ` · last attempt ${relDayLabel(failedAttempt.when)}` : ""}`;
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
  const stubSquad = squadName ? squadName.toUpperCase() : hasSquad ? "SQUAD" : "SOLO";

  const handleStart = () => {
    startSolving({
      id: computed?.problem.order_index ?? 518,
      title: pickTitle,
      slug: pickSlug,
      difficulty: pickDifficulty,
      category: pickPattern,
    });
    window.open(`https://leetcode.com/problems/${pickSlug}/`, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="space-y-8 select-none">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="pass">
              <div className="pass-body space-y-4">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-12 w-56" />
              </div>
              <div className="pass-stub">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 select-none">
      <div>
        <h1 className="type-display-md text-text-primary">Arena</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {todayLabel} · New pick at midnight
        </p>
      </div>

      {loadError && (
        <ErrorCard message={loadError} onRetry={handleRetryLoad} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Focal column */}
        <div className="min-w-0 space-y-6">
          {solvedToday ? (
            <Pass
              body={
                <div className="space-y-4">
                  <h2 className="type-display-md text-text-primary">{pickTitle}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <DifficultyBadgeNew difficulty={pickDifficulty} />
                    <PatternChip label={pickPattern} href={`/patterns/${encodeURIComponent(pickPattern)}`} />
                    <span className="font-mono text-sm text-text-tertiary tnum">No. {pickNo}</span>
                  </div>
                  <div className="type-mono-display text-text-primary tnum">
                    {heroTime}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {callerVerified ? <VerifiedBadge /> : <SelfReportedBadge />}
                    <span className="text-sm leading-6 text-text-secondary">
                      {rankLine}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => {
                        window.location.href = `/practice/${pickSlug}#explain`;
                      }}
                    >
                      Explain your approach
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => {
                        window.location.href = `/challenges?problem=${pickSlug}&title=${encodeURIComponent(pickTitle)}`;
                      }}
                    >
                      {challengeTime ? `Challenge a teammate to beat ${challengeTime}` : "Challenge a teammate"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => {
                        window.location.href = `/practice/${pickSlug}/compare`;
                      }}
                    >
                      Compare with your squad
                    </Button>
                  </div>
                </div>
              }
              stub={
                <>
                  <PassSerial>NO. {pickNo}</PassSerial>
                  <PassSerial>{stubDate}</PassSerial>
                  <PassSerial>{stubSquad}</PassSerial>
                  <PassSerial>{hasSquad ? `${solvedCount} OF ${squadMemberIds.length} SOLVED` : "SOLO PRACTICE"}</PassSerial>
                </>
              }
            />
          ) : (
            <Pass
              body={
                <div className="space-y-4">
                  <h2 className="type-display-md text-text-primary">{pickTitle}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <DifficultyBadgeNew difficulty={pickDifficulty} />
                    <PatternChip label={pickPattern} href={`/patterns/${encodeURIComponent(pickPattern)}`} />
                    <span className="font-mono text-sm text-text-tertiary tnum">No. {pickNo}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowReasons((v) => !v)}
                      aria-expanded={showReasons}
                      className="min-h-[44px] text-left text-sm leading-6 text-text-secondary"
                    >
                      Why this one · {reasonCount} {reasonCount === 1 ? "reason" : "reasons"}
                      {showReasons ? " · hide" : ""}
                    </button>
                    {showReasons && (
                      <ul className="mt-1 space-y-1">
                        {reasons.map((r) => (
                          <li key={r} className="flex gap-2 text-sm leading-6 text-text-secondary">
                            <span aria-hidden>·</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {avatarPeople.length > 0 && <AvatarStack people={avatarPeople} />}
                    <p className="text-sm leading-6 text-text-secondary">
                      {socialNames} · {fastestLine}
                    </p>
                  </div>
                  {isRunningThis ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-text-primary tnum">
                        In progress · {fmtClock(seconds)}
                      </span>
                      <Button
                        variant="primary"
                        size="lg"
                        className="min-h-[44px]"
                        onClick={() => {
                          window.location.href = `/practice/${pickSlug}`;
                        }}
                      >
                        Resume
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-[44px]"
                        onClick={() => {
                          window.location.href = "/stuck";
                        }}
                      >
                        Stuck?
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="primary" size="lg" className="min-h-[44px]" onClick={handleStart}>
                        Start battle
                      </Button>
                      <a
                        href={`https://leetcode.com/problems/${pickSlug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
                      >
                        Open on LeetCode
                        <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                      </a>
                    </div>
                  )}
                </div>
              }
              stub={
                <>
                  <PassSerial>NO. {pickNo}</PassSerial>
                  <PassSerial>{stubDate}</PassSerial>
                  <PassSerial>{stubSquad}</PassSerial>
                  <PassSerial>{hasSquad ? `${solvedCount} OF ${squadMemberIds.length} SOLVED` : "SOLO PRACTICE"}</PassSerial>
                </>
              }
            />
          )}

          {/* Up next */}
          <section className="card space-y-3" aria-label="Up next">
            <h2 className="text-lg font-semibold leading-7 text-text-primary">Up next</h2>
            <ProblemRow
              href={`/practice/${upNextSlug}`}
              title={upNextTitle}
              number={upNextNo}
              difficulty={upNextDifficulty}
              pattern={upNextPattern}
              status={failedAttempt ? "attempted" : "none"}
              socialHint={failedAttempt ? "Revenge available" : undefined}
              bestTime={revengeLabel ?? undefined}
            />
            <p className="text-sm leading-6 text-text-secondary">
              {revengeLine ?? `Easiest unsolved starter${upNextList.length > 1 ? " — skip any time" : ""}.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                className="min-h-[44px]"
                onClick={() =>
                  startSolving({
                    id: upNext?.order_index ?? 1,
                    title: upNextTitle,
                    slug: upNextSlug,
                    difficulty: upNextDifficulty,
                    category: upNextPattern,
                  })
                }
              >
                {failedAttempt ? "Take revenge" : "Start battle"}
              </Button>
              {upNextList.length > 1 && (
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={() => setUpNextIndex((i) => i + 1)}
                >
                  Not this
                </Button>
              )}
            </div>
          </section>

          {/* From your squad */}
          <section className="space-y-3" aria-label="From your squad">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold leading-7 text-text-primary">From your squad</h2>
              <Link
                href="/feed"
                className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
              >
                See all in Feed
              </Link>
            </div>
            <div className="card space-y-3">
              {feed.length > 0 ? (
                feed.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 text-sm leading-6">
                    <span className="min-w-0 flex-1 truncate text-text-secondary">
                      <span className="font-medium text-text-primary">
                        @{e.actor_profile?.username ?? "someone"}
                      </span>{" "}
                      {e.event_type === "solve"
                        ? `solved ${(e.metadata as { problem_slug?: string })?.problem_slug ?? "a problem"}`
                        : e.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="shrink-0 text-xs leading-4 text-text-tertiary">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-5 text-text-primary">Nothing here yet</p>
                    <p className="text-sm leading-6 text-text-secondary">
                      When your squad solves or explains, it shows up here.
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Rail */}
        <aside className="space-y-3" aria-label="Waiting on you">
          <h2 className="text-lg font-semibold leading-7 text-text-primary">Waiting on you</h2>

          {activityError && (
            <ErrorCard message={activityError} onRetry={() => setActivityRefreshKey((k) => k + 1)} />
          )}

          {incomingChallenge ? (
            <Link
              href="/challenges"
              className="card-interactive flex min-h-[44px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-xs font-medium text-text-secondary">
                {incomingChallenge.fromName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                  {incomingChallenge.fromName} challenged you
                </span>
                <span className="block truncate text-xs leading-4 text-text-tertiary">
                  {incomingChallenge.problemTitle} · {incomingChallenge.difficulty}
                  {incomingChallenge.beatSec != null && formatDuration(incomingChallenge.beatSec)
                    ? ` · beat ${formatDuration(incomingChallenge.beatSec)}`
                    : ""}
                  {challengeDue ? ` · due ${challengeDue}` : ""}
                  {incomingCount > 1 ? ` · ${incomingCount} waiting` : ""}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
            </Link>
          ) : incomingLoaded ? (
            <div className="card px-4 py-3">
              <p className="text-sm leading-6 text-text-secondary">
                No open challenges. Enjoy the calm.
              </p>
            </div>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}

          <Link
            href="/squad"
            className="card-interactive block min-h-[44px] rounded-xl border border-hairline bg-surface px-4 py-3"
          >
            <span className="flex items-center gap-3">
              {squadStreak ? (
                <StreakChip
                  count={squadStreak.days}
                  alive={hasSquad && unsolvedLabels.length === 0}
                />
              ) : (
                <span className="flex h-7 items-center text-xs leading-4 text-text-tertiary">…</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                  Squad streak · {squadStreak ? `${squadStreak.days} days` : "…"}
                </span>
                <span className="block truncate text-xs leading-4 text-text-tertiary">
                  {streakSub}
                </span>
              </span>
            </span>
            {weekAllSolved.length > 0 && (
              <span className="mt-2 flex items-center gap-1.5" aria-label="Days this week the whole squad solved">
                {weekAllSolved.map((done, i) => (
                  <span
                    key={i}
                    title={done ? "Whole squad solved" : "Not yet"}
                    className={done ? "h-2 w-2 rounded-full bg-verified" : "h-2 w-2 rounded-full border border-hairline-strong"}
                  />
                ))}
              </span>
            )}
          </Link>

          <Link
            href="/squad"
            className="card-interactive block min-h-[44px] rounded-xl border border-hairline bg-surface px-4 py-3"
          >
            {goal ? (
              <>
                <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                  {goal.goal.title}
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-well">
                  <span
                    className="block h-full rounded-full bg-pattern"
                    style={{ width: `${Math.min(100, goal.pct)}%` }}
                  />
                </span>
                <span className="mt-1.5 block text-xs leading-4 text-text-tertiary">
                  {goal.done} of {goal.target}
                  {goal.daysRemaining != null ? ` · ${goal.daysRemaining} days left` : ""}
                  {` · ${goal.participants} of ${goal.memberCount} contributed`}
                </span>
              </>
            ) : (
              <>
                <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                  No active goal
                </span>
                <span className="mt-1.5 block text-xs leading-4 text-text-tertiary">
                  Set one in the Squad hub to give the week a target.
                </span>
              </>
            )}
          </Link>

          <Link
            href="/practice"
            className="card-interactive flex min-h-[44px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                {reviewCount > 0 ? `${reviewCount} problems due for review` : "Nothing due for review"}
              </span>
              <span className="block truncate text-xs leading-4 text-text-tertiary">
                {reviewCount > 0 ? "Open Practice to clear them" : "You're caught up"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
          </Link>

          <p className="px-1 text-xs leading-4 text-text-tertiary">{syncLabel(profile?.last_synced_at ?? null)}</p>
          {!hasSquad && (
            <div className="card space-y-2">
              <p className="text-sm font-medium leading-5 text-text-primary">Practicing solo</p>
              <p className="text-sm leading-6 text-text-secondary">Invite your people to start the streak.</p>
              <Button variant="ghost" className="min-h-[44px]" onClick={() => (window.location.href = "/squad")}>
                Invite
              </Button>
            </div>
          )}
          {!profile?.last_synced_at && (
            <div className="card space-y-2">
              <p className="text-sm leading-6 text-text-secondary">Connect LeetCode to verify your solves.</p>
              <Button variant="ghost" className="min-h-[44px]" onClick={() => (window.location.href = "/squad")}>
                Connect LeetCode
              </Button>
            </div>
          )}
        </aside>
      </div>

    </div>
  );
}
