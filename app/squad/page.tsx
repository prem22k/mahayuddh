"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Copy, Check, ChevronDown, Flame, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteLink } from "@/components/squad/InviteLink";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { ModalShell } from "@/components/ui/ModalShell";
import { Pass, PassSerial } from "@/components/pass/Pass";
import { Button } from "@/components/ui/Button";
import { PatternChip, StreakChip } from "@/components/ui/Badge";
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
import { RITUALS } from "@/lib/rituals";
import { Squad, SquadMember, SquadSeason } from "@/types/database";

function formatSince(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}`;
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
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
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
  // useMemo stays above every early return (rules of hooks).
  const weekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return {
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
      };
    });
  }, []);

  if (loading) return <PageLoader label="Loading squad..." />;

  const firstGoal = goalProgress[0] ?? null;
  const todayIdx = weekDays.length - 1;
  const solvedTodayCount = members.filter(
    (m) => weekGrid[m.user_id]?.[todayIdx] ?? false
  ).length;
  const unsolvedShort = members
    .filter((m) => !(weekGrid[m.user_id]?.[todayIdx] ?? false))
    .map((m) =>
      user && m.user_id === user.id ? "you" : (m.profile?.username || "Member").split(" ")[0]
    );
  const streakLine = activityError
    ? "Couldn't load today's solves"
    : streak == null
      ? "Loading streak…"
      : members.length === 0
        ? "No members yet"
        : unsolvedShort.length === 0
          ? `${solvedTodayCount} of ${members.length} solved today · everyone solved`
          : `${solvedTodayCount} of ${members.length} solved today · ${unsolvedShort.slice(0, 2).join(" and ")} to go`;
  const squadSince = activeSquad
    ? new Date(activeSquad.created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-8 select-none">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => setShowSwitcher((v) => !v)}
            aria-expanded={showSwitcher}
            className="inline-flex min-h-[44px] items-center gap-2 text-left"
          >
            <h1 className="type-display-md text-text-primary">{activeSquad?.name ?? "Squad"}</h1>
            {squads.length > 1 && <ChevronDown className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />}
          </button>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {members.length} members{squadSince ? ` · since ${squadSince}` : ""}
          </p>
          {showSwitcher && squads.length > 1 && (
            <div className="popover-panel mt-2 w-64 p-2">
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
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="ghost" className="min-h-[44px]" onClick={() => { setFormError(null); setShowJoin(true); }}>
            Join with code
          </Button>
          <Button variant="secondary" className="min-h-[44px]" onClick={() => { setFormError(null); setShowCreate(true); }}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New squad
          </Button>
        </div>
      </div>

      {loadError && <ErrorCard message={loadError} onRetry={load} />}
      {activityError && <ErrorCard message={activityError} onRetry={load} />}

      {squads.length === 0 ? (
        <div className="card space-y-3 p-12 text-center">
          <p className="text-sm font-medium leading-5 text-text-primary">Your squad is waiting.</p>
          <p className="mx-auto max-w-sm text-sm leading-6 text-text-secondary">
            Create one and invite 2–7 friends — or join with a code. Solo practice keeps working either way.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="primary" className="min-h-[44px]" onClick={() => setShowCreate(true)}>
              Create squad
            </Button>
            <Button variant="secondary" className="min-h-[44px]" onClick={() => setShowJoin(true)}>
              Join with code
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Focal column */}
          <div className="min-w-0 space-y-6">
            <Pass
              body={
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Flame className="h-6 w-6 text-primary" strokeWidth={1.5} />
                    <span className="type-numeral-xl text-text-primary tnum">
                      {streak ? `${streak.days} days` : activityError ? "—" : "…"}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {streakLine}
                  </p>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[72px_repeat(7,1fr)] items-center gap-1 text-xs leading-4 text-text-tertiary">
                      <span />
                      {weekDays.map((d) => (
                        <span key={d.key} className="text-center">{d.label}</span>
                      ))}
                    </div>
                    {members.length > 0 ? (
                      members
                        .map((m) => ({
                          id: m.user_id,
                          name: (m.profile?.username || "Member").split(" ")[0],
                          full: m.profile?.username || "Member",
                        }))
                        .map((row) => (
                          <div key={row.id} className="grid grid-cols-[72px_repeat(7,1fr)] items-center gap-1">
                            <span className="truncate text-xs leading-4 text-text-secondary">{row.name}</span>
                            {weekDays.map((d, di) => {
                              const filled = weekGrid[row.id]?.[di] ?? false;
                              return (
                                <span
                                  key={d.key}
                                  title={`${row.full} · ${d.label} · ${filled ? "solved" : "not yet"}`}
                                  className={cn(
                                    "mx-auto h-2 w-2 rounded-full",
                                    filled ? "bg-verified" : "border border-hairline-strong"
                                  )}
                                />
                              );
                            })}
                          </div>
                        ))
                    ) : (
                      <p className="text-sm leading-6 text-text-secondary">No members yet.</p>
                    )}
                  </div>
                  <Button variant="primary" size="lg" className="min-h-[44px]" onClick={() => (window.location.href = "/home")}>
                    Solve today&apos;s battle
                  </Button>
                </div>
              }
              stub={
                <>
                  <PassSerial>{(activeSquad?.name ?? "Squad").toUpperCase()}</PassSerial>
                  {streak ? <PassSerial>SINCE {formatSince(streak.since)}</PassSerial> : null}
                  <PassSerial>{members.length} MEMBERS</PassSerial>
                </>
              }
            />

            {/* Goal card */}
            <section className="card space-y-3" aria-label="Squad goal">
              {firstGoal ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold leading-7 text-text-primary">{firstGoal.goal.title}</h2>
                    {firstGoal.goal.pattern && <PatternChip label={firstGoal.goal.pattern} />}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-well">
                    <div className="h-full rounded-full bg-pattern transition-all" style={{ width: `${Math.min(100, firstGoal.pct)}%` }} />
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {firstGoal.done} of {firstGoal.target}
                    {firstGoal.daysRemaining != null ? ` · ${firstGoal.daysRemaining} days left` : " · 5 days left"}
                  </p>
                  <p className="text-xs leading-4 text-text-tertiary">
                    {firstGoal.participants} of {firstGoal.memberCount} members have contributed
                  </p>
                  {firstGoal.nudge && <p className="text-sm leading-6 text-text-secondary">{firstGoal.nudge}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" className="min-h-[44px]" onClick={() => { setFormError(null); setShowGoal(true); }}>
                      Edit goal
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={async () => {
                        if (!window.confirm(`Mark "${firstGoal.goal.title}" complete for the whole squad?`)) return;
                        try {
                          await completeSquadGoal(firstGoal.goal.id, firstGoal.goal.squad_id);
                          await load();
                        } catch {
                          setLoadError("Couldn't mark the goal complete. Try again.");
                        }
                      }}
                    >
                      Mark complete
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold leading-7 text-text-primary">No active goal yet</h2>
                  <p className="text-sm leading-6 text-text-secondary">
                    Set one to give the squad a shared target.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" className="min-h-[44px]" onClick={() => { setFormError(null); setShowGoal(true); }}>
                      Set a goal
                    </Button>
                  </div>
                </>
              )}
            </section>

            {/* Members */}
            <section className="space-y-2" aria-label="Squad members">
              <h2 className="text-lg font-semibold leading-7 text-text-primary">Members</h2>
              <div className="card divide-y divide-hairline">
                {members.length === 0 ? (
                  <p className="py-2.5 text-sm leading-6 text-text-secondary">No members yet.</p>
                ) : (
                  members
                    .map((m) => ({
                      id: m.user_id,
                      name: m.profile?.username || "Member",
                      admin: m.role === "admin",
                      solves: solveCounts[m.user_id] ?? 0,
                      streak: m.profile?.streak ?? 0,
                      mine: m.user_id === user?.id,
                    }))
                    .map((m) => (
                  <div key={m.id} className="flex min-h-[44px] items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={m.name} size="md" />
                      <div className="truncate">
                        <span className="text-sm font-medium leading-5 text-text-primary">
                          {m.name}
                          {m.mine ? " (you)" : ""}
                          {m.admin ? " · Admin" : ""}
                        </span>
                        <span className="block font-mono text-xs text-text-tertiary tnum">
                          {m.solves} solves this week · {m.streak}-day streak
                        </span>
                      </div>
                    </div>
                    {!m.mine ? (
                      <Link
                        href={`/challenges?to=${m.id}`}
                        className="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                      >
                        Challenge
                      </Link>
                    ) : (
                      <span className="text-xs italic leading-4 text-text-tertiary">you</span>
                    )}
                  </div>
                    ))
                )}
              </div>
            </section>
          </div>

          {/* Rail */}
          <aside className="space-y-6">
            {activeSquad && (
              <section className="card space-y-2" aria-label="Invite your people">
                <h2 className="text-lg font-semibold leading-7 text-text-primary">Invite your people</h2>
                <button
                  onClick={handleCopyInvite}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-md border border-hairline bg-well px-3 font-mono text-sm text-text-primary tnum"
                  title="Copy invite code"
                >
                  <span>{activeSquad.invite_code}</span>
                  {copied ? (
                    <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                  ) : (
                    <Copy className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </button>
                <InviteLink squadId={activeSquad.id} squadName={activeSquad.name} />
                <p className="text-xs leading-4 text-text-tertiary">Share the code or the link below.</p>
              </section>
            )}

            <section className="card space-y-2" aria-label="Season">
              <h2 className="text-lg font-semibold leading-7 text-text-primary">
                {season ? season.name : "No active season"}
              </h2>
              <p className="text-sm leading-6 text-text-secondary">
                {season
                  ? season.objective_target != null
                    ? `${seasonMetrics?.solves ?? 0} of ${season.objective_target}${season.objective_pattern ? ` ${season.objective_pattern}` : ""} solves`
                    : season.objective
                      ? season.objective
                      : seasonMetrics
                        ? `${seasonMetrics.solves} solves this season`
                        : "Season progress loads with your solves."
                  : "Start a season to track a squad objective."}
              </p>
              {seasonMetrics && (
                <p className="font-mono text-xs text-text-tertiary tnum">
                  {seasonMetrics.solves} solves · {seasonMetrics.challengesSent} sent · {seasonMetrics.approachesWritten} approaches
                </p>
              )}
              <Link
                href={activeId ? `/squad/${activeId}/seasons` : "/squad"}
                className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
              >
                See season summary
              </Link>
            </section>

            {activeId && (
              <nav className="card space-y-1" aria-label="Squad links">
                <Link
                  href={`/squad/${activeId}/wall`}
                  className="flex min-h-[44px] items-center justify-between text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
                >
                  Squad wall
                  <span aria-hidden>›</span>
                </Link>
                <Link
                  href={`/squad/${activeId}/recaps`}
                  className="flex min-h-[44px] items-center justify-between text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
                >
                  Weekly recaps
                  <span aria-hidden>›</span>
                </Link>
              </nav>
            )}

            <section className="space-y-2" aria-label="Weekly rhythm">
              <h2 className="text-sm font-medium leading-5 text-text-secondary">Weekly rhythm</h2>
              <p className="text-xs leading-4 text-text-tertiary">Mon: new goal · Wed: challenge day · Sun: recap</p>
              <div className="grid grid-cols-2 gap-2">
                {RITUALS.map((r) => (
                  <Link
                    key={r.day}
                    href={r.href}
                    className="card-interactive block min-h-[44px] rounded-xl border border-hairline bg-surface px-3 py-2"
                  >
                    <span className="font-mono text-xs text-text-tertiary tnum">{r.day}</span>
                    <span className="block text-xs font-medium leading-4 text-text-primary">{r.label}</span>
                  </Link>
                ))}
              </div>
            </section>

            {hotChain && (
              <Link
                href={`/c/${hotChain.leafId}`}
                className="card-interactive block rounded-xl border border-hairline bg-surface px-4 py-3"
              >
                <span className="block text-sm font-medium leading-5 text-text-primary">
                  Challenge chain — {hotChain.problemTitle}
                </span>
                <span className="mt-1 block text-xs leading-4 text-text-tertiary">
                  {hotChain.hops} {hotChain.hops === 1 ? "hop" : "hops"} · still open
                </span>
              </Link>
            )}

            <div className="flex items-center gap-1.5">
              {streak ? (
                <>
                  <StreakChip
                    count={streak.days}
                    alive={members.length > 0 && unsolvedShort.length === 0}
                  />
                  <span className="text-xs leading-4 text-text-tertiary">squad streak</span>
                </>
              ) : (
                <span className="text-xs leading-4 text-text-tertiary">
                  {activityError ? "Couldn't load streak" : "Loading streak…"}
                </span>
              )}
            </div>
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

      {season && seasonMetrics && (
        <section className="space-y-2">
          <span className="text-sm font-medium leading-5 text-text-secondary">Season — {season.name}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: "Solves", value: seasonMetrics.solves },
              { label: "Challenges sent", value: seasonMetrics.challengesSent },
              { label: "Completed", value: seasonMetrics.challengesCompleted },
              { label: "Approaches", value: seasonMetrics.approachesWritten },
              { label: "Active members", value: seasonMetrics.activeMembers },
            ].map((m) => (
              <div key={m.label} className="card p-3 text-center">
                <div className="font-display text-2xl font-semibold text-text-primary tnum">{m.value}</div>
                <div className="mt-0.5 text-xs leading-4 text-text-tertiary">{m.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs leading-4 text-text-tertiary">Counts, not a score. There is nothing to unlock.</p>
        </section>
      )}

      {activeId && (
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/squad/${activeId}/recaps`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
          >
            Weekly recaps
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={`/squad/${activeId}/wall`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
          >
            Squad wall
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      <Link
        href="/challenges"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
      >
        Open challenges
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
