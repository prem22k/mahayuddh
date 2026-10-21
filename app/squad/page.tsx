"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  LogOut,
  LogIn,
  Ellipsis,
  PanelsTopLeft,
  CalendarDays,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteLink } from "@/components/squad/InviteLink";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { ModalShell } from "@/components/ui/ModalShell";
import { SquadStreakPass, type StreakPassMember } from "@/components/squad/SquadStreakPass";
import { Button } from "@/components/ui/Button";
import { PatternChip } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorCard } from "@/components/ui/States";
import {
  getMySquads,
  getSquadDetail,
  getSquadSolveCounts,
  createSquad,
  joinSquad,
  switchActiveSquad,
  leaveSquad,
  createSquadGoal,
  completeSquadGoal,
} from "@/lib/data/squads";
import { getSquadChallengeRows } from "@/lib/data/challenges";
import {
  getSquadStreak,
  getMemberWeekGrid,
  type SquadStreak,
} from "@/lib/data/squadActivity";
import { longestActiveChain } from "@/lib/chains";
import {
  squadWeekDayNums,
  squadDayKeyFromDayNum,
  squadDayLabel,
} from "@/lib/squadDays";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { logFeedEvent } from "@/lib/data/feed";
import {
  computeGoalProgress,
  getActiveGoals,
  getSeasons,
  computeSeasonMetrics,
  GoalProgress,
  SeasonMetrics,
} from "@/lib/data/goals";
import { getRecaps } from "@/lib/data/recap";
import { RITUALS } from "@/lib/rituals";
import { Squad, SquadMember, SquadRecap, SquadSeason } from "@/types/database";

/** Three-letter months, so September reads "Sep" (en-GB ICU says "Sept"). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Midday on the calendar day, so a date-only string never slips a day by zone. */
function calendarDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

/** "9 Oct 2026" */
function formatDayMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "3 Oct" */
function formatDayMonth(iso: string): string {
  const d = calendarDay(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "5–11 Oct", or "28 Sep – 4 Oct" across a month boundary. */
function formatWeekRange(startIso: string, endIso: string): string {
  const a = calendarDay(startIso);
  const b = calendarDay(endIso);
  const month = (d: Date) => MONTHS[d.getMonth()];
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

export default function SquadPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [activeId, setActiveId] = useState<string | null>(profile?.active_squad_id ?? null);
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [season, setSeason] = useState<SquadSeason | null>(null);
  const [seasonMetrics, setSeasonMetrics] = useState<SeasonMetrics | null>(null);
  const [solveCounts, setSolveCounts] = useState<Record<string, number>>({});
  const [activeSquad, setActiveSquad] = useState<Squad | null>(null);
  const [hotChain, setHotChain] = useState<ReturnType<typeof longestActiveChain>>(null);
  const [streak, setStreak] = useState<SquadStreak | null>(null);
  const [weekGrid, setWeekGrid] = useState<Record<string, boolean[]>>({});
  const [latestRecap, setLatestRecap] = useState<SquadRecap | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showGoalMenu, setShowGoalMenu] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("50");
  const [goalPattern, setGoalPattern] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const mine = await getMySquads(user.id, profile?.active_squad_id ?? null);
      setSquads(mine.squads);
      const resolvedActive =
        mine.activeSquadId && mine.squads.some((s) => s.id === mine.activeSquadId)
          ? mine.activeSquadId
          : (mine.squads[0]?.id ?? null);
      setActiveId(resolvedActive);
      if (resolvedActive) {
        const detail = await getSquadDetail(resolvedActive);
        setActiveSquad(detail.squad);
        setMembers(detail.members);
        setSolveCounts(await getSquadSolveCounts(detail.members.map((m) => m.user_id)));

        try {
          const memberIds = detail.members.map((m) => m.user_id);
          const [st, grid] = await Promise.all([
            getSquadStreak(memberIds),
            getMemberWeekGrid(memberIds, 7),
          ]);
          setStreak(st);
          setWeekGrid(grid);
          setActivityError(null);
        } catch {
          setStreak(null);
          setWeekGrid({});
          setActivityError("Couldn't load squad activity. Try again.");
        }

        const activeGoals = await getActiveGoals(resolvedActive);
        const progress = await Promise.all(
          activeGoals.map((g) => computeGoalProgress(g, detail.members).catch(() => null))
        );
        setGoalProgress(progress.filter((p): p is GoalProgress => p !== null));

        const seasons = await getSeasons(resolvedActive).catch(() => []);
        const live = seasons.find((x) => x.status === "active") ?? null;
        setSeason(live);
        setSeasonMetrics(
          live
            ? await computeSeasonMetrics(live, detail.members.map((m) => m.user_id)).catch(() => null)
            : null
        );
        const chainRows = await getSquadChallengeRows(resolvedActive).catch(() => []);
        setHotChain(longestActiveChain(chainRows));
        // Only the "Last: 5–11 Oct" caption on the recaps link; never blocks the page.
        const recaps = await getRecaps(resolvedActive, 1).catch(() => []);
        setLatestRecap(recaps[0] ?? null);
      } else {
        setActiveSquad(null);
        setMembers([]);
        setGoalProgress([]);
        setSeason(null);
        setSeasonMetrics(null);
        setSolveCounts({});
        setHotChain(null);
        setStreak(null);
        setWeekGrid({});
        setActivityError(null);
        setLatestRecap(null);
      }
    } catch (err) {
      console.error("Error loading squad:", err);
      setLoadError(dataErrorMessage(err, "Couldn't load your squad. Check your connection and retry."));
    } finally {
      setLoading(false);
    }
  }, [user, profile?.active_squad_id]);

  useEffect(() => {
    load();
  }, [load]);

  const inviteLink = (s: Squad | null) =>
    s && typeof window !== "undefined" ? `${window.location.origin}/squad/join/${s.invite_code}` : "";

  const handleCopyInvite = async () => {
    if (!activeSquad) return;
    if (await copyText(inviteLink(activeSquad))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      const squad = await createSquad({ name: name.trim(), description: description.trim() || undefined });
      track("squad_created", { via: "squad_page", squad_id: squad.id });
      setName("");
      setDescription("");
      setShowCreate(false);
      await refreshProfile();
      await load();
      setActiveId(squad.id);
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't create squad. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      const { squad } = await joinSquad(code, null);
      track("invite_opened", { squad_id: squad.id });
      track("squad_joined", { via: "code", squad_id: squad.id });
      setCode("");
      setShowJoin(false);
      await refreshProfile();
      await load();
      setActiveId(squad.id);
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't join squad. Check the code."));
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async (id: string) => {
    try {
      await switchActiveSquad(id);
      await refreshProfile();
      await load();
      setShowSwitcher(false);
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't switch squad. Try again."));
    }
  };

  const handleLeave = async () => {
    if (!activeId || !user) return;
    if (!window.confirm("Leave this squad? Your solves and notes stay yours.")) return;
    try {
      await leaveSquad(activeId, user.id);
      await refreshProfile();
      await load();
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't leave squad. Try again."));
    }
  };

  const handleGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !goalTitle.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      await createSquadGoal({
        squad_id: activeId,
        title: goalTitle,
        target_count: parseInt(goalTarget, 10) || 50,
        pattern: goalPattern || undefined,
        deadline: goalDeadline || undefined,
      });
      logFeedEvent({
        eventType: "squad_milestone",
        squadId: activeId,
        metadata: { kind: "goal_set", title: goalTitle },
      }).catch(() => {});
      setGoalTitle("");
      setGoalTarget("50");
      setGoalPattern("");
      setGoalDeadline("");
      setShowGoal(false);
      await load();
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't create goal. Try again."));
    } finally {
      setBusy(false);
    }
  };

  // Real last-7-day labels, oldest -> newest, aligned with the week grid.
  // Squad-local (IST) buckets — same day definition as getMemberWeekGrid.
  // useMemo stays above every early return (rules of hooks).
  const weekDays = useMemo(() => {
    return squadWeekDayNums(7).map((dayNum) => ({
      key: squadDayKeyFromDayNum(dayNum),
      label: squadDayLabel(dayNum),
    }));
  }, []);

  if (loading) return <PageLoader label="Loading squad..." />;

  const firstGoal = goalProgress[0] ?? null;
  const todayLabel = weekDays[weekDays.length - 1]?.label ?? "";
  const passMembers: StreakPassMember[] = members.map((m) => ({
    id: m.user_id,
    name: (m.profile?.username || "Member").split(" ")[0],
    full: m.profile?.username || "Member",
    avatarUrl: m.profile?.avatar_url ?? null,
    mine: m.user_id === user?.id,
  }));
  const squadSince = activeSquad ? formatDayMonthYear(activeSquad.created_at) : null;
  const memberWord = members.length === 1 ? "member" : "members";
  const seasonMet =
    season?.objective_target != null &&
    seasonMetrics != null &&
    seasonMetrics.solves >= season.objective_target;

  return (
    <div className="space-y-6 select-none md:space-y-8">
      {/* Heading row: switcher + facts, actions on the right (desktop). */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 md:border-b md:border-hairline md:pb-6">
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowSwitcher((v) => !v)}
              aria-expanded={showSwitcher}
              className="group inline-flex min-h-[44px] min-w-0 items-center gap-2 text-left md:gap-2.5"
            >
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-text-primary transition-colors group-hover:text-primary md:text-3xl">
                {activeSquad?.name ?? "Squad"}
              </h1>
              {squads.length > 1 && (
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-hover:translate-y-0.5 group-hover:text-primary md:h-5 md:w-5"
                  strokeWidth={2}
                />
              )}
            </button>
            {activeSquad && (
              <span className="shrink-0 rounded-xs border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-text-secondary tnum md:hidden">
                {members.length} {memberWord}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 md:mt-1">
            <p className="text-xs leading-5 text-text-secondary md:text-sm">
              <span className="hidden md:inline">
                {members.length} {memberWord}
                {squadSince ? ` · practicing DSA since ${squadSince}` : ""}
              </span>
              <span className="md:hidden">
                {squadSince ? `Since ${squadSince}` : `${members.length} ${memberWord}`}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2 text-xs text-text-secondary md:hidden">
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-text-primary"
                onClick={() => { setFormError(null); setShowJoin(true); }}
              >
                Join code
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center hover:text-text-primary"
                onClick={() => { setFormError(null); setShowCreate(true); }}
              >
                + New squad
              </button>
            </div>
          </div>
          {showSwitcher && squads.length > 1 && (
            <div className="popover-panel absolute left-0 top-full z-20 mt-2 w-64 p-2">
              {squads.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSwitch(s.id)}
                  className={cn(
                    "flex min-h-[44px] w-full items-center justify-between rounded-md px-3 text-sm font-medium leading-5",
                    s.id === activeId ? "bg-surface-overlay text-text-primary" : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <span>{s.name}</span>
                  <span className="font-mono text-xs text-text-tertiary tnum">{s.member_count ?? ""}</span>
                </button>
              ))}
              <button
                onClick={handleLeave}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm font-medium leading-5 text-error"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                Leave squad
              </button>
            </div>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => { setFormError(null); setShowJoin(true); }}
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-hairline bg-surface px-3.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <LogIn className="h-4 w-4" strokeWidth={1.5} />
            Join with code
          </button>
          <button
            type="button"
            onClick={() => { setFormError(null); setShowCreate(true); }}
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-hairline bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[#272830]"
          >
            <Plus className="h-4 w-4 text-text-secondary" strokeWidth={1.5} />
            New squad
          </button>
        </div>
      </div>

      {loadError && <ErrorCard message={loadError} onRetry={load} />}
      {activityError && <ErrorCard message={activityError} onRetry={load} />}

      {squads.length === 0 ? (
        <div className="rounded-lg border border-hairline bg-surface p-8 text-center md:p-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/30 bg-primary-tint text-primary">
            <Flame className="h-6 w-6" strokeWidth={2} />
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">Your squad is waiting.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            Create one and invite 2–7 friends — or join with a code. Solo practice keeps working either way.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-5">
            <Button variant="primary" className="min-h-[44px]" onClick={() => setShowCreate(true)}>
              Create squad
            </Button>
            <Button variant="secondary" className="min-h-[44px]" onClick={() => setShowJoin(true)}>
              Join with code
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Focal column */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-8 lg:gap-8">
            <SquadStreakPass
              squadName={activeSquad?.name ?? "Squad"}
              streakLabel="squad streak"
              members={passMembers}
              weekDays={weekDays}
              weekGrid={weekGrid}
              streak={streak}
              activityError={activityError}
              onSolve={() => (window.location.href = "/home")}
            />

            {/* Goal card */}
            <section className="rounded-lg border border-hairline bg-surface p-4 md:p-6" aria-label="Squad goal">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary md:text-xs">
                      <span className="md:hidden">Goal</span>
                      <span className="hidden md:inline">Active squad goal</span>
                    </span>
                    {firstGoal?.goal.pattern && (
                      <PatternChip label={firstGoal.goal.pattern} className="h-5 text-[11px] md:h-6 md:text-xs" />
                    )}
                  </div>
                  <h2 className="font-display text-base font-semibold tracking-tight text-text-primary md:text-xl">
                    {firstGoal ? firstGoal.goal.title : "No active goal yet"}
                  </h2>
                </div>
                <div className="relative flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setFormError(null); setShowGoal(true); }}
                    className="relative h-8 rounded-sm px-3 text-xs font-medium text-text-secondary transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:bg-surface-raised hover:text-text-primary md:before:hidden"
                  >
                    {firstGoal ? "Edit goal" : "Set a goal"}
                  </button>
                  {firstGoal && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowGoalMenu((v) => !v)}
                        aria-label="Goal options"
                        aria-haspopup="menu"
                        aria-expanded={showGoalMenu}
                        className="relative flex h-8 w-8 items-center justify-center rounded-sm text-text-tertiary transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-raised hover:text-text-primary md:before:hidden"
                      >
                        <Ellipsis className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      {showGoalMenu && (
                        <>
                          <button
                            aria-hidden
                            tabIndex={-1}
                            onClick={() => setShowGoalMenu(false)}
                            className="fixed inset-0 z-10 cursor-default"
                          />
                          <div role="menu" className="popover-panel absolute right-0 top-full z-20 mt-1.5 min-w-[10rem] p-1.5">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={async () => {
                                setShowGoalMenu(false);
                                if (!window.confirm(`Mark "${firstGoal.goal.title}" complete for the whole squad?`)) return;
                                try {
                                  await completeSquadGoal(firstGoal.goal.id, firstGoal.goal.squad_id);
                                  await load();
                                } catch {
                                  setLoadError("Couldn't mark the goal complete. Try again.");
                                }
                              }}
                              className="flex min-h-[44px] w-full items-center rounded-md px-3 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-9"
                            >
                              Mark complete
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {firstGoal ? (
                <>
                  <div className="mt-3 md:mt-4">
                    <div className="mb-1.5 flex items-center justify-between gap-3 font-mono text-xs text-text-secondary tnum md:mb-2">
                      <span className="font-medium text-text-primary">
                        {firstGoal.done} of {firstGoal.target}
                        <span className="hidden md:inline"> solves</span>
                      </span>
                      <span className="text-text-tertiary">
                        {firstGoal.daysRemaining != null
                          ? `${firstGoal.daysRemaining} ${firstGoal.daysRemaining === 1 ? "day" : "days"} left`
                          : "No deadline"}
                        <span className="hidden md:inline"> · {firstGoal.pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline bg-well md:h-2">
                      <div
                        className="h-full rounded-full bg-pattern transition-all"
                        style={{ width: `${Math.min(100, firstGoal.pct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-col gap-1 text-[11px] leading-4 text-text-secondary sm:flex-row sm:items-center sm:justify-between md:mt-4 md:border-t md:border-hairline md:pt-3 md:text-xs">
                    <span>
                      <strong className="font-medium text-text-primary">
                        {firstGoal.participants} of {firstGoal.memberCount}
                      </strong>{" "}
                      members have contributed
                    </span>
                    {firstGoal.nudge && <span className="text-text-tertiary">{firstGoal.nudge}</span>}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Set one to give the squad a shared target.
                </p>
              )}
            </section>

            {/* Members */}
            <section className="flex flex-col gap-2 md:gap-3" aria-label="Squad members">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-base font-semibold tracking-tight text-text-primary md:text-lg">
                  <span className="hidden md:inline">Squad Members</span>
                  <span className="md:hidden">Members</span>{" "}
                  <span className="font-sans text-sm font-normal text-text-tertiary">({members.length})</span>
                </h2>
                <span className="font-mono text-[11px] text-text-tertiary md:text-xs">Last 7 days</span>
              </div>
              <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
                {members.length === 0 ? (
                  <p className="px-4 py-3 text-sm leading-6 text-text-secondary">No members yet.</p>
                ) : (
                  members
                    .map((m) => ({
                      id: m.user_id,
                      name: m.profile?.username || "Member",
                      avatarUrl: m.profile?.avatar_url ?? null,
                      admin: m.role === "admin",
                      solves: solveCounts[m.user_id] ?? 0,
                      streak: m.profile?.streak ?? 0,
                      mine: m.user_id === user?.id,
                    }))
                    .map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex min-h-[56px] items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-raised md:px-5 md:py-2",
                          m.mine && "bg-surface-overlay/30"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5 md:gap-3.5">
                          <Avatar
                            name={m.name}
                            src={m.avatarUrl}
                            size="md"
                            className={cn(
                              "h-7 w-7 border border-hairline text-[11px] font-semibold text-text-primary md:h-8 md:w-8 md:text-xs",
                              m.mine && "border-primary/30 bg-primary/20 text-primary"
                            )}
                          />
                          <div className="flex min-w-0 flex-col">
                            <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
                              <span className="truncate text-xs font-medium leading-5 text-text-primary md:text-sm">
                                {m.name}
                                {m.mine ? " (you)" : ""}
                              </span>
                              {m.admin && (
                                <span className="shrink-0 rounded-xs border border-hairline bg-surface-raised px-1 font-mono text-[9px] uppercase leading-4 text-text-tertiary md:px-1.5 md:text-[10px]">
                                  Admin
                                </span>
                              )}
                            </div>
                            <span className="truncate font-mono text-[10px] leading-4 text-text-secondary tnum md:text-xs">
                              <span className="md:hidden">
                                {m.solves} solves · {m.streak}d LeetCode streak
                              </span>
                              <span className="hidden md:inline">
                                {m.solves} solves this week · {m.streak}-day LeetCode streak
                              </span>
                            </span>
                          </div>
                        </div>
                        {!m.mine ? (
                          <Link
                            href={`/challenges?to=${m.id}`}
                            className="relative inline-flex h-7 shrink-0 items-center rounded-xs border border-hairline bg-surface-raised px-2.5 text-[11px] font-medium text-text-secondary transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:text-text-primary md:h-8 md:rounded-sm md:border-transparent md:bg-transparent md:px-3 md:text-xs md:before:hidden md:hover:border-hairline md:hover:bg-surface-overlay"
                          >
                            Challenge
                          </Link>
                        ) : (
                          <span className="shrink-0 px-2 font-mono text-[11px] text-text-tertiary md:text-xs">You</span>
                        )}
                      </div>
                    ))
                )}
              </div>
            </section>
          </div>

          {/* Rail */}
          <aside className="flex flex-col gap-6 lg:col-span-4">
            {activeSquad && (
              <section className="rounded-lg border border-hairline bg-surface p-4 md:p-5" aria-label="Invite your people">
                <h2 className="font-display text-sm font-semibold tracking-tight text-text-primary md:text-base">
                  Invite your people
                </h2>
                <p className="mb-3 mt-1 text-xs leading-relaxed text-text-secondary md:mb-4 md:mt-2">
                  Bring developers you trust to keep the streak alive.
                  <span className="hidden md:inline"> No random lobbies.</span>
                </p>
                <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xs border border-hairline bg-well p-2.5 md:mb-3 md:rounded-md md:p-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="hidden font-mono text-[10px] uppercase tracking-wider text-text-tertiary md:block">
                      Squad code
                    </span>
                    <span className="truncate font-mono text-xs font-semibold tracking-wider text-text-primary tnum md:text-base md:tracking-widest">
                      {activeSquad.invite_code}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyInvite}
                    title="Copy invite code"
                    aria-label="Copy invite code"
                    className="relative inline-flex shrink-0 items-center justify-center font-mono text-[11px] text-primary before:absolute before:-inset-3 before:content-[''] hover:underline md:h-8 md:w-8 md:rounded-sm md:bg-surface-overlay md:text-text-secondary md:before:hidden md:hover:bg-[#272830] md:hover:text-text-primary md:hover:no-underline"
                  >
                    <span className="md:hidden">{copied ? "Copied" : "Copy"}</span>
                    <span className="hidden md:inline-flex">
                      {copied ? (
                        <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                      ) : (
                        <Copy className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </span>
                  </button>
                </div>
                <InviteLink squadId={activeSquad.id} squadName={activeSquad.name} />
              </section>
            )}

            <section className="rounded-lg border border-hairline bg-surface p-4 md:p-5" aria-label="Season">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary md:text-[11px]">
                  Squad season
                </span>
                {season &&
                  (seasonMet ? (
                    <span className="rounded-xs border border-verified/20 bg-verified-tint px-1.5 py-0.5 font-mono text-[10px] font-medium text-verified">
                      Objective met
                    </span>
                  ) : (
                    <span className="rounded-xs border border-hairline bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">
                      Active
                    </span>
                  ))}
              </div>
              <h2 className="font-display text-sm font-semibold tracking-tight text-text-primary md:text-base">
                {season ? season.name : "No active season"}
              </h2>
              {season && (
                <p className="mt-0.5 font-mono text-xs text-text-tertiary tnum">
                  Started {formatDayMonth(season.starts_at)}
                  {season.ends_at ? ` · ends ${formatDayMonth(season.ends_at)}` : ""}
                </p>
              )}
              {season ? (
                <div className="mt-3 rounded-md border border-hairline bg-well p-3">
                  {season.objective_target != null && (
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs text-text-secondary">
                        Objective{season.objective_pattern ? ` · ${season.objective_pattern}` : ""}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold text-text-primary tnum">
                        {seasonMetrics?.solves ?? 0} of {season.objective_target}
                      </span>
                    </div>
                  )}
                  {season.objective ? (
                    <p className="text-[11px] leading-snug text-text-secondary">{season.objective}</p>
                  ) : season.objective_target == null ? (
                    <p className="text-[11px] leading-snug text-text-secondary">
                      {seasonMetrics
                        ? `${seasonMetrics.solves} solves this season`
                        : "Season progress loads with your solves."}
                    </p>
                  ) : null}
                  {seasonMetrics && (
                    <p className="mt-2 font-mono text-[11px] leading-4 text-text-tertiary tnum">
                      {seasonMetrics.solves} solves · {seasonMetrics.challengesSent} sent ·{" "}
                      {seasonMetrics.challengesCompleted} completed · {seasonMetrics.approachesWritten} approaches ·{" "}
                      {seasonMetrics.activeMembers} active
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  Start a season to track a squad objective.
                </p>
              )}
              <Link
                href={activeId ? `/squad/${activeId}/seasons` : "/squad"}
                className="mt-3 flex h-8 min-h-[44px] w-full items-center justify-center gap-1.5 rounded-sm text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
              >
                See season summary
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            </section>

            {activeId && (
              <nav
                className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface"
                aria-label="Squad links"
              >
                <Link
                  href={`/squad/${activeId}/wall`}
                  className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:text-xs"
                >
                  <span className="flex items-center gap-2.5">
                    <PanelsTopLeft className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                    Squad wall
                  </span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                </Link>
                <Link
                  href={`/squad/${activeId}/recaps`}
                  className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:text-xs"
                >
                  <span className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                    <span className="flex flex-col">
                      <span>Weekly recaps</span>
                      {latestRecap && (
                        <span className="font-mono text-[10px] font-normal text-text-tertiary tnum">
                          Last: {formatWeekRange(latestRecap.week_start, latestRecap.week_end)}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                </Link>
                {hotChain && (
                  <Link
                    href={`/c/${hotChain.leafId}`}
                    className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Waypoints className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">Challenge chain — {hotChain.problemTitle}</span>
                        <span className="font-mono text-[10px] font-normal text-text-tertiary tnum">
                          {hotChain.hops} {hotChain.hops === 1 ? "hop" : "hops"} · still open
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                  </Link>
                )}
              </nav>
            )}

            <section className="rounded-lg border border-hairline bg-well p-4" aria-label="Weekly rhythm">
              <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Weekly squad rhythm
              </h2>
              <ul className="flex flex-col md:gap-1">
                {RITUALS.map((r) => {
                  const isToday = r.day === todayLabel;
                  return (
                    <li key={r.day}>
                      <Link
                        href={r.href}
                        title={r.intent}
                        className="flex min-h-[44px] items-center gap-2 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary md:min-h-[24px]"
                      >
                        <span
                          aria-hidden
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isToday ? "bg-primary" : "bg-text-tertiary")}
                        />
                        <span>
                          <strong className="font-semibold text-text-primary">{r.day}:</strong>{" "}
                          {r.label.toLowerCase()}
                          {isToday && <span className="sr-only"> (today)</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      )}

      {showCreate && (
        <ModalShell label="Create squad" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4 p-1">
            <h3 className="font-display text-xl font-semibold text-text-primary">Create a squad</h3>
            <p className="text-sm leading-6 text-text-secondary">2–7 friends works best. You&apos;ll get an invite code to share.</p>
            {formError && <div className="text-sm leading-6 text-error">{formError}</div>}
            <input
              aria-label="Squad name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Graph Warriors"
              maxLength={60}
              required
              className="w-full rounded-md border border-hairline bg-well px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
            />
            <input
              aria-label="What the squad is preparing for, optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you preparing for? (optional)"
              maxLength={500}
              className="w-full rounded-md border border-hairline bg-well px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
            />
            <Button variant="secondary" size="full" loading={busy} className="min-h-[44px]">
              Create squad
            </Button>
          </form>
        </ModalShell>
      )}

      {showJoin && (
        <ModalShell label="Join squad" onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin} className="space-y-4 p-1">
            <h3 className="font-display text-xl font-semibold text-text-primary">Join with invite code</h3>
            {formError && <div className="text-sm leading-6 text-error">{formError}</div>}
            <input
              aria-label="Invite code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. KQ7X2P9M"
              maxLength={8}
              required
              className="w-full rounded-md border border-hairline bg-well px-3.5 py-2.5 font-mono text-sm uppercase text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
            />
            <Button variant="secondary" size="full" loading={busy} className="min-h-[44px]">
              Join squad
            </Button>
          </form>
        </ModalShell>
      )}

      {showGoal && (
        <ModalShell label="Set squad goal" onClose={() => setShowGoal(false)}>
          <form onSubmit={handleGoal} className="space-y-4 p-1">
            <h3 className="font-display text-xl font-semibold text-text-primary">Set a squad goal</h3>
            <p className="text-sm leading-6 text-text-secondary">
              Several goals can run at once. Each one counts solves inside its own window, from its start date.
            </p>
            {formError && <div className="text-sm leading-6 text-error">{formError}</div>}
            <input
              aria-label="Goal title"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Complete 50 Graph problems"
              maxLength={120}
              required
              className="w-full rounded-md border border-hairline bg-well px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="Target number of solves"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                type="number"
                min={1}
                max={10000}
                placeholder="Target"
                className="rounded-md border border-hairline bg-well px-3.5 py-2.5 font-mono text-sm text-text-primary focus:border-hairline-strong"
              />
              <input
                aria-label="Pattern, optional"
                value={goalPattern}
                onChange={(e) => setGoalPattern(e.target.value)}
                placeholder="Pattern (optional)"
                className="rounded-md border border-hairline bg-well px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
              />
            </div>
            <input
              aria-label="Deadline"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
              type="date"
              className="w-full rounded-md border border-hairline bg-well px-3.5 py-2.5 text-sm text-text-primary focus:border-hairline-strong"
            />
            <Button variant="secondary" size="full" loading={busy} className="min-h-[44px]">
              Set goal
            </Button>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
