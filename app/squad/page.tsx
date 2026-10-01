"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Users, Copy, Check, Target, ArrowRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { ModalShell } from "@/components/ui/ModalShell";
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
import { longestActiveChain, CHAIN_STATE_CLASS, CHAIN_STATE_LABEL } from "@/lib/chains";
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
  // Step 17: the squad's longest live chain is a reason to come back.
  const [hotChain, setHotChain] = useState<ReturnType<typeof longestActiveChain>>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
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

        // Multiple goals, each with windowed progress.
        const activeGoals = await getActiveGoals(resolvedActive);
        const progress = await Promise.all(
          activeGoals.map((g) => computeGoalProgress(g, detail.members).catch(() => null))
        );
        setGoalProgress(progress.filter((p): p is GoalProgress => p !== null));

        // Season + plain metrics, no score.
        const seasons = await getSeasons(resolvedActive).catch(() => []);
        const live = seasons.find((x) => x.status === "active") ?? null;
        setSeason(live);
        setSeasonMetrics(
          live
            ? await computeSeasonMetrics(live, detail.members.map((m) => m.user_id)).catch(() => null)
            : null
        );
        // Step 17: longest live chain in this squad.
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
      const squad = await joinSquad(code);
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

  if (loading) return <PageLoader label="Loading squad..." />;


  return (
    <div className="space-y-8 select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Who am I doing this with?</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Squad</h1>
          <p className="text-xs text-white/40 mt-1">Small groups, shared goals, friendly accountability.</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button onClick={() => { setFormError(null); setShowJoin(true); }} className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-bold transition-all cursor-pointer">
            Join with code
          </button>
          <button onClick={() => { setFormError(null); setShowCreate(true); }} className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>New squad</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
          <span className="text-xs text-[#ff453a] font-medium">{loadError}</span>
          <button onClick={load} className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 hover:bg-[#ff453a]/25 border border-[#ff453a]/30 text-[#ff453a] text-xs font-bold transition-all cursor-pointer shrink-0">
            Retry
          </button>
        </div>
      )}

      {squads.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
          <p className="text-sm font-bold text-white">Your squad is waiting.</p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">Create one and invite 2–7 friends — or join with a code. Solo practice keeps working either way.</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold cursor-pointer">Create squad</button>
            <button onClick={() => setShowJoin(true)} className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold cursor-pointer">Join with code</button>
          </div>
        </div>
      ) : (
        <>
          {squads.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Active:</span>
              {squads.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSwitch(s.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                    s.id === activeId
                      ? "bg-[#fa586a]/15 border-[#fa586a]/40 text-white"
                      : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {activeSquad && (
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-extrabold text-white">{activeSquad.name}</h2>
                  {activeSquad.description && <p className="text-xs text-white/40 mt-1">{activeSquad.description}</p>}
                  <p className="text-[11px] text-white/30 mt-1 font-mono">{members.length} member{members.length === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopyInvite} className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5" title="Copy invite link">
                    {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="font-mono">{copied ? "Copied!" : activeSquad.invite_code}</span>
                  </button>
                  <button onClick={handleLeave} className="p-2 rounded-full text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer" title="Leave squad" aria-label="Leave squad">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Goals (Step 19: multiple, and progress measured inside the
                  goal's window rather than all-time). */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    <span>Squad goals</span>
                  </span>
                  <button onClick={() => { setFormError(null); setShowGoal(true); }} className="text-xs text-[#fa586a] font-semibold hover:underline cursor-pointer">
                    Set a goal
                  </button>
                </div>

                {goalProgress.length === 0 ? (
                  <p className="text-[11px] text-white/30">
                    No active goal. Set one — e.g. “Complete 50 Graph problems by Oct 30.”
                  </p>
                ) : (
                  <div className="space-y-2">
                    {goalProgress.map((gp) => (
                      <div key={gp.goal.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{gp.goal.title}</span>
                          <button
                            onClick={async () => {
                              await completeSquadGoal(gp.goal.id, gp.goal.squad_id);
                              await load();
                            }}
                            className="text-[11px] text-white/40 hover:text-[#30d158] font-semibold cursor-pointer"
                          >
                            Mark complete
                          </button>
                        </div>
                        <div className="text-[11px] text-white/40 mt-1 font-mono">
                          {gp.done} / {gp.target} solves
                          {gp.goal.pattern ? ` · ${gp.goal.pattern}` : ""}
                          {gp.goal.starts_at ? ` · since ${gp.goal.starts_at}` : ""}
                          {gp.daysRemaining != null ? ` · ${gp.daysRemaining}d left` : ""}
                        </div>
                        <div className="text-[10px] text-white/30 mt-0.5">
                          {gp.participants} of {gp.memberCount}{" "}
                          {gp.memberCount === 1 ? "member has" : "members have"} contributed
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-[#fa586a] transition-all" style={{ width: `${gp.pct}%` }} />
                        </div>
                        {/* The nudge only appears when it is close enough to act on. */}
                        {gp.nudge && (
                          <p className="text-[11px] text-[#ff9f0a] mt-1.5">{gp.nudge}</p>
                        )}
                        {gp.remaining === 0 && (
                          <p className="text-[11px] text-[#30d158] mt-1.5">Goal reached.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Members</span>
                <div className="divide-y divide-white/[0.04]">
                  {members.map((m) => (
                    <div key={`${m.squad_id}-${m.user_id}`} className="flex items-center justify-between py-2.5 gap-2">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden">
                          {m.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.profile.avatar_url} alt={m.profile.username} className="w-full h-full object-cover" />
                          ) : (
                            (m.profile?.username || "?").charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-semibold text-white">{m.profile?.username || "Member"}</span>
                          {m.role === "admin" && <span className="ml-1.5 text-[9px] font-bold text-[#fa586a] uppercase">admin</span>}
                          <span className="block text-[10px] text-white/30 font-mono">
                            {solveCounts[m.user_id] ?? 0} solves · {m.profile?.streak ?? 0}d streak
                          </span>
                        </div>
                      </div>
                      {m.user_id !== user?.id ? (
                        <Link href={`/challenges?to=${m.user_id}`} className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#fa586a] hover:text-white border border-white/[0.08] text-white/60 text-[11px] font-semibold transition-all shrink-0">
                          Challenge
                        </Link>
                      ) : (
                        <span className="text-[10px] text-white/25 italic">you</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (<ModalShell label="Create squad" onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreate} className="space-y-4 p-1">
          <h3 className="text-base font-bold text-white">Create a squad</h3>
          <p className="text-[11px] text-white/40">2–7 friends works best. You&apos;ll get an invite code to share.</p>
          {formError && <div className="text-xs text-[#ff453a]">{formError}</div>}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Graph Warriors" maxLength={60} required
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you preparing for? (optional)" maxLength={500}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-full bg-[#fa586a] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Creating…" : "Create squad"}
          </button>
        </form>
      </ModalShell>)}

      {showJoin && (<ModalShell label="Join squad" onClose={() => setShowJoin(false)}>
        <form onSubmit={handleJoin} className="space-y-4 p-1">
          <h3 className="text-base font-bold text-white">Join with invite code</h3>
          {formError && <div className="text-xs text-[#ff453a]">{formError}</div>}
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. KQ7X2P9M" maxLength={8} required
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono uppercase" />
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-full bg-[#fa586a] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Joining…" : "Join squad"}
          </button>
        </form>
      </ModalShell>)}

      {showGoal && (<ModalShell label="Set squad goal" onClose={() => setShowGoal(false)}>
        <form onSubmit={handleGoal} className="space-y-4 p-1">
          <h3 className="text-base font-bold text-white">Set a squad goal</h3>
          <p className="text-[11px] text-white/40">One active goal at a time. Progress counts all-time squad solves.</p>
          {formError && <div className="text-xs text-[#ff453a]">{formError}</div>}
          <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. Complete 50 Graph problems" maxLength={120} required
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
          <div className="grid grid-cols-2 gap-3">
            <input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} type="number" min={1} max={10000} placeholder="Target"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60 font-mono" />
            <input value={goalPattern} onChange={(e) => setGoalPattern(e.target.value)} placeholder="Pattern (optional)"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
          </div>
          <input value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} type="date"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60" />
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-full bg-[#fa586a] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Saving…" : "Set goal"}
          </button>
        </form>
      </ModalShell>)}

      {/* ── Season (Step 19). Plain counts, no unlocks, no shop. ── */}
      {season && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              Season — {season.name}
            </span>
            <span className="text-[10px] text-white/30 font-mono">
              {season.starts_at}
              {season.ends_at ? ` → ${season.ends_at}` : " → open"}
            </span>
          </div>
          {season.objective && (
            <p className="text-xs text-white/50">{season.objective}</p>
          )}
          {seasonMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: "Solves", value: seasonMetrics.solves },
                { label: "Challenges sent", value: seasonMetrics.challengesSent },
                { label: "Completed", value: seasonMetrics.challengesCompleted },
                { label: "Approaches", value: seasonMetrics.approachesWritten },
                { label: "Active members", value: seasonMetrics.activeMembers },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                  <div className="text-xl font-black text-white font-mono">{m.value}</div>
                  <div className="text-[10px] text-white/35 mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-white/25">
            Counts, not a score. There is nothing to unlock.
          </p>
        </section>
      )}

      {/* ── Rituals (Step 19). Config only — nothing is scheduled. ── */}
      <section className="space-y-2">
        <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
          Weekly rituals
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RITUALS.map((r) => (
            <Link
              key={r.day}
              href={r.href}
              className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-all"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#fa586a] font-mono">{r.day}</span>
                <span className="text-[11px] font-bold text-white/80">{r.label}</span>
              </div>
              <div className="text-[10px] text-white/35 mt-1 leading-snug">{r.intent}</div>
            </Link>
          ))}
        </div>
        <p className="text-[10px] text-white/25">
          A suggestion, not a schedule. Nobody is going to remind you.
        </p>
      </section>

      {/* ── Longest live chain (Step 17) ── */}
      {hotChain && (
        <Link
          href={`/c/${hotChain.leafId}`}
          className="block p-5 rounded-3xl bg-[#bf5af2]/[0.07] border border-[#bf5af2]/25 hover:border-[#bf5af2]/45 transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold text-[#bf5af2] uppercase tracking-wider">
              Challenge chain — {hotChain.problemTitle}
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
              CHAIN_STATE_CLASS.active
            )}>
              {hotChain.hops} {hotChain.hops === 1 ? "hop" : "hops"} · {CHAIN_STATE_LABEL.active}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1.5">
            This problem has travelled through {hotChain.hops} {hotChain.hops === 1 ? "person" : "people"} in your squad and is still open.
          </p>
        </Link>
      )}

      {/* Step 20 surfaces. Both are read-only projections over rows that
          already exist — nothing here creates a second source of truth. */}
      {activeId && (
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href={`/squad/${activeId}/recaps`}
            className="flex items-center gap-1.5 text-xs text-[#bf5af2] font-semibold hover:underline"
          >
            <span>Weekly recaps</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/squad/${activeId}/wall`}
            className="flex items-center gap-1.5 text-xs text-[#30d158] font-semibold hover:underline"
          >
            <span>Squad wall</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <Link href="/challenges" className="flex items-center gap-1.5 text-xs text-[#fa586a] font-semibold hover:underline">
        <span>Open challenges</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
