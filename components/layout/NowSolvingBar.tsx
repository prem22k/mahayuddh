"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Check,
  ArrowUp,
  MoreHorizontal,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import {
  useSolving,
  useSolvingTimer,
  BATTLE_ID_STORAGE_KEY,
} from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { toggleProblemStatus, setProblemStatus } from "@/lib/data/sheets";
import { track } from "@/lib/analytics";
import { startBattle, heartbeatBattle, endBattle } from "@/lib/data/battles";
import { logProblemEvent } from "@/lib/data/problemEvents";
import { logFeedEvent } from "@/lib/data/feed";
import { revengeResultLabel, RevengeResult } from "@/lib/revenge";
import { StuckLadder } from "@/components/battle/StuckLadder";
import { detectRevengeCompletion } from "@/lib/data/revenge";

interface NowSolvingBarProps {
  onSearchOpen?: () => void;
}

/** Which problem the stored battle id belongs to (resume-after-refresh guard). */
const BATTLE_SLUG_KEY = "mahayuddh_battle_slug";

interface BattleOutcome {
  kind: "solved" | "failed";
  title: string;
  seconds: number;
}

export function NowSolvingBar({ onSearchOpen }: NowSolvingBarProps) {
  const { user, profile, session } = useAuth();
  // The shell can mount before auth resolves. Until it has, a solve or fail
  // would skip the write (no user) yet still end the battle, so the ending
  // actions stay locked.
  const canEnd = Boolean(user);
  const {
    activeProblem,
    setActiveProblem,
    isPlaying,
    setIsPlaying,
    resetSolving,
  } = useSolving();
  // Ticking subscription: only the dock reads the per-second timer, so only
  // the dock re-renders on tick. Timer math itself is untouched.
  const { seconds } = useSolvingTimer();

  // Elapsed time is the provider's accumulated value (performance.now()
  // deltas, frozen while paused). Never derived from Date.now() here, so
  // clock jumps cannot invent solving time.
  const elapsedSec = seconds;

  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState("");
  // A solve or fail is in flight: the buttons lock so it can't be sent twice.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // The write was rejected: the battle stays open and the dock says so.
  const [saveError, setSaveError] = useState<string | null>(null);
  // How the last battle ended. Shown in the dock for a moment after it clears.
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isHeartbeatLeader, setIsHeartbeatLeader] = useState(true);
  // Step 17: closes the "failed -> solved" loop with the real before/after.
  const [revengeResult, setRevengeResult] = useState<RevengeResult | null>(null);
  // Feeds the ladder's suggested level: how many tries have you already had?
  const [attemptCount, setAttemptCount] = useState(1);
  const [capsuleMenuOpen, setCapsuleMenuOpen] = useState(false);

  // Load scratchpad note whenever activeProblem changes
  useEffect(() => {
    setSessionExpired(false);
    if (activeProblem?.slug) {
      const savedNote = localStorage.getItem(`mahayuddh_notes_${activeProblem.slug}`) || "";
      setScratchpadNote(savedNote);
      setSaveError(null);
      setOutcome(null);
      setStuckOpen(false);

      // Resume the existing server session after a refresh. Without this the
      // battleId was lost, heartbeats silently no-op'd, and the server row was
      // abandoned by the next start (Step 7: "session survives refresh").
      const storedBattleId = (() => {
        try {
          return localStorage.getItem(BATTLE_ID_STORAGE_KEY);
        } catch {
          return null;
        }
      })();
      // How many recorded attempts exist, so the ladder can suggest a level
      // instead of always opening at "nudge".
      import("@/lib/data/battles")
        .then(({ getBattlesForSlug }) => getBattlesForSlug(activeProblem.slug, 25))
        .then((rows) => setAttemptCount(Math.max(1, rows.length)))
        .catch(() => setAttemptCount(1));

      const storedSlug = (() => {
        try {
          const raw = localStorage.getItem(BATTLE_SLUG_KEY);
          return raw;
        } catch {
          return null;
        }
      })();

      if (storedBattleId && storedSlug === activeProblem.slug) {
        setBattleId(storedBattleId);
        return;
      }

      // Persist a server session (fire-and-forget; localStorage is the fallback).
      if (user) {
        startBattle(
          activeProblem.slug,
          profile?.active_squad_id ?? null,
          activeProblem.challengeId ?? null
        ).then((res) => {
          if (res.battle) {
            setBattleId(res.battle.id);
            try {
              localStorage.setItem(BATTLE_ID_STORAGE_KEY, res.battle.id);
              localStorage.setItem(BATTLE_SLUG_KEY, activeProblem.slug);
            } catch {
              // ignore
            }
          }
        }).catch(() => {});
      } else {
        setBattleId(null);
      }
    } else {
      setScratchpadNote("");
      setBattleId(null);
    }
    // user?.id: when the dock mounts before auth resolves, start the server
    // session once the user arrives instead of never.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProblem?.slug, user?.id]);

  // The per-second tick lives in the provider (performance.now()
  // accumulation); this component only re-renders from `seconds`.

  // Multi-tab leader election: only one tab heartbeats. Tabs announce over a
  // BroadcastChannel and the lowest id wins; others suppress heartbeats but
  // keep counting locally so a leader handoff never loses time.
  // A page restored from the back/forward cache gets a fresh channel (epoch).
  const [electionEpoch, setElectionEpoch] = useState(0);
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setElectionEpoch((n) => n + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      setIsHeartbeatLeader(true);
      return;
    }
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const peers = new Set<string>([tabId]);
    let closed = false;
    const channel = new BroadcastChannel("mahayuddh_battle_heartbeat");
    // Posting on a closed channel throws InvalidStateError. The page keeps
    // running for a moment after pagehide (the ping interval used to fire into
    // a channel beforeunload had already closed), so every send is guarded.
    const send = (msg: { type: "hello" | "ping" | "bye"; id: string }) => {
      if (closed) return;
      try {
        channel.postMessage(msg);
      } catch {
        // closed underneath us
      }
    };
    const elect = () => {
      if (closed) return;
      const leader = Array.from(peers).sort()[0];
      setIsHeartbeatLeader(leader === tabId);
    };
    channel.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; id?: string } | null;
      if (!msg || typeof msg.id !== "string") return;
      if (msg.type === "hello" || msg.type === "ping") {
        peers.add(msg.id);
        send({ type: "hello", id: tabId });
        elect();
      } else if (msg.type === "bye") {
        peers.delete(msg.id);
        elect();
      }
    };
    send({ type: "hello", id: tabId });
    const ping = setInterval(() => send({ type: "ping", id: tabId }), 5000);
    const t = setTimeout(elect, 600);
    const shutdown = () => {
      if (closed) return;
      send({ type: "bye", id: tabId });
      closed = true;
      clearInterval(ping);
      clearTimeout(t);
      channel.close();
    };
    window.addEventListener("pagehide", shutdown);
    return () => {
      window.removeEventListener("pagehide", shutdown);
      shutdown();
    };
  }, [electionEpoch]);

  const handleSaveNote = (text: string) => {
    setScratchpadNote(text);
    if (activeProblem?.slug) {
      localStorage.setItem(`mahayuddh_notes_${activeProblem.slug}`, text);
      // Mirror to server session (debounced by keystroke batching upstream).
      if (battleId) {
        heartbeatBattle(battleId, { scratchpad_md: text.slice(0, 20000) })
          .then((res) => {
            if (res.expired) {
              setSessionExpired(true);
              setIsPlaying(false);
            }
          })
          .catch(() => {});
      }
    }
  };

  // Heartbeat duration every 15s while solving (plan Step 7: persist every 15s).
  // Sends the accumulated value, only from the leader tab. A 410/expired
  // response stops the timer and tells the truth instead of counting silently.
  useEffect(() => {
    if (!isPlaying || !battleId || !isHeartbeatLeader || sessionExpired) return;
    let stopped = false;
    const send = () => {
      heartbeatBattle(battleId, { duration_sec: elapsedSec })
        .then((res) => {
          if (stopped) return;
          if (res.expired) {
            setSessionExpired(true);
            setIsPlaying(false);
          }
        })
        .catch(() => {});
    };
    send();
    const t = setInterval(send, 15000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [isPlaying, battleId, isHeartbeatLeader, sessionExpired, elapsedSec, setIsPlaying]);

  // A battle that has ended (solved or failed) leaves the dock. Before this the
  // problem stayed loaded after a solve, so the dock sat on "Solved" and a
  // refresh resumed a battle that was already over.
  const clearBattle = useCallback(() => {
    try {
      localStorage.removeItem(BATTLE_SLUG_KEY);
    } catch {
      // ignore
    }
    setBattleId(null);
    setStuckOpen(false);
    setIsScratchpadOpen(false);
    setCapsuleMenuOpen(false);
    setSaveError(null);
    resetSolving();
    // Also drops the persisted active problem, timer and battle id.
    setActiveProblem(null);
  }, [resetSolving, setActiveProblem]);

  // The outcome line is a confirmation, not a state: it steps aside on its own.
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => setOutcome(null), 4000);
    return () => clearTimeout(t);
  }, [outcome]);

  const handleComplete = useCallback(async (evidence: "leetcode" | "none" = "none") => {
    if (!activeProblem || !user || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    // Snapshot: the dock clears below, so nothing after this reads live state.
    const problem = activeProblem;
    const duration = elapsedSec;
    const endedBattleId = battleId;

    try {
      // Persist first: only celebrate + notify when the write lands, so open
      // views never show a solve the database rejected.
      if (user) {
        let saved = false;
        // Revisit detection: solving an already-solved problem logs "revisited".
        let wasSolved = false;
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: prev } = await supabase
            .from("user_problem_status")
            .select("status")
            .eq("user_id", user.id)
            .eq("problem_slug", problem.slug.toLowerCase())
            .maybeSingle();
          wasSolved = (prev as { status: string } | null)?.status === "solved";
          saved = await toggleProblemStatus(user.id, problem.slug, true);
        } catch (err) {
          console.error("Error marking problem as solved in Supabase:", err);
        }
        if (!saved) {
          // Keep the battle and the timer: nothing was recorded, so nothing ends.
          setSaveError("Solve not saved. Check your connection and try again.");
          return;
        }
        track("battle_solved", { problem_slug: problem.slug });
        if (wasSolved) track("revisit_done", { problem_slug: problem.slug, via: "dock" });
        // A server battle writes its own history row when it ends
        // (append_problem_event_on_battle_end, exactly once). Logging here as
        // well raced that trigger: the client "solved" landed first, the
        // trigger then saw a prior solve and appended a "revisited", and every
        // solve counted twice. The client logs only when no server row will.
        const logClientEvent = () =>
          logProblemEvent({
            problemSlug: problem.slug,
            kind: wasSolved ? "revisited" : "solved",
            battleId: null,
            durationSec: duration,
            source: evidence === "leetcode" ? "leetcode" : "self",
          }).catch(() => {});
        if (endedBattleId) {
          endBattle(endedBattleId, "solved", { duration_sec: duration, evidence })
            .then((res) => {
              if (res.error) logClientEvent();
            })
            .catch(logClientEvent);
        } else {
          logClientEvent();
        }
        // Squad activity: solves generate feed without requiring prose (§50).
        logFeedEvent({
          eventType: "solve",
          squadId: profile?.active_squad_id ?? null,
          problemTitle: problem.title,
          problemSlug: problem.slug,
          difficulty: problem.difficulty,
          metadata: { duration_sec: duration, source: evidence },
        }).catch(() => {});

        // Revenge (Step 17): a solve that answers a recorded failure is a
        // different event from a solve — it closes a loop the user opened.
        if (endedBattleId) {
          detectRevengeCompletion(problem.slug, endedBattleId, problem.title)
            .then((result) => {
              if (!result) return;
              track("revenge_completed", {
                problem_slug: problem.slug,
                improved: result.improved,
              });
              setRevengeResult(result);
            })
            .catch(() => {});
        }
        // Notify open sheet views so their solved status refreshes immediately.
        window.dispatchEvent(
          new CustomEvent("problem-status-changed", {
            detail: { slug: problem.slug, status: "solved" },
          })
        );
      }

      setIsPlaying(false);
      clearBattle();
      setOutcome({ kind: "solved", title: problem.title, seconds: duration });

      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.9 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [activeProblem, setIsPlaying, user, battleId, elapsedSec, profile?.active_squad_id, clearBattle]);

  const handleFail = useCallback(async () => {
    if (!activeProblem || !user || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    const problem = activeProblem;
    const duration = elapsedSec;
    const endedBattleId = battleId;
    try {
      // Failed ≠ unsolved: record an honest attempt, never downgrade a prior solve.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("user_problem_status")
        .select("status")
        .eq("user_id", user.id)
        .eq("problem_slug", problem.slug.toLowerCase())
        .maybeSingle();
      if ((existing as { status: string } | null)?.status !== "solved") {
        const saved = await setProblemStatus(user.id, problem.slug, "attempted");
        if (!saved) {
          setSaveError("Attempt not saved. Check your connection and try again.");
          return;
        }
        window.dispatchEvent(
          new CustomEvent("problem-status-changed", {
            detail: { slug: problem.slug, status: "attempted" },
          })
        );
      }
      // Same rule as a solve: the battle-end trigger owns the history row.
      let serverRecorded = false;
      if (endedBattleId) {
        const res = await endBattle(endedBattleId, "failed", { duration_sec: duration }).catch(
          () => ({ error: "network" })
        );
        serverRecorded = !res.error;
      }
      if (!serverRecorded) {
        await logProblemEvent({
          problemSlug: problem.slug,
          kind: "failed",
          battleId: null,
          durationSec: duration,
        }).catch(() => {});
      }
      track("battle_failed", { problem_slug: problem.slug });
      // No feed event: failed battles stay private until revenge (Phase 3).
      setIsPlaying(false);
      clearBattle();
      setOutcome({ kind: "failed", title: problem.title, seconds: duration });
    } catch (err) {
      console.error("Error recording failed battle:", err);
      setSaveError("Attempt not saved. Check your connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [activeProblem, user, battleId, elapsedSec, setIsPlaying, clearBattle]);

  const handleAbandon = useCallback(async () => {
    if (!activeProblem || submittingRef.current) return;
    if (!window.confirm("Abandon this battle? The timer stops; nothing is recorded as attempted.")) return;
    if (battleId) {
      await endBattle(battleId, "abandoned", { duration_sec: elapsedSec }).catch(() => null);
    }
    setIsPlaying(false);
    clearBattle();
  }, [activeProblem, battleId, elapsedSec, setIsPlaying, clearBattle]);

  // Background auto-detection: check if active problem was accepted on LeetCode while solving
  useEffect(() => {
    if (!isPlaying || !activeProblem?.slug || !profile?.leetcode_username) return;

    const interval = setInterval(async () => {
      // Visibility gate only: the timer/heartbeat math below is untouched.
      // A hidden tab skips the network poll; detection resumes on return.
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/sync/leetcode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ username: profile.leetcode_username }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const activeSlug = activeProblem.slug.toLowerCase();
        const isAc = (data?.recentSubmissions || []).some(
          (s: { titleSlug: string }) => s.titleSlug?.toLowerCase() === activeSlug
        );
        if (isAc) {
          handleComplete("leetcode");
        }
      } catch {
        // silent fail
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [isPlaying, activeProblem?.slug, profile?.leetcode_username, handleComplete, session?.access_token]);

  return (
    <>
      {/* ── REVENGE COMPLETE (Step 17). A solve that answers a recorded failure
          is a different event from a solve: it closes a loop the user opened. ── */}
      {revengeResult && (
        <div className="fixed bottom-24 left-1/2 z-[160] w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 space-y-2 rounded-xl border border-verified/30 bg-surface-raised p-4 shadow-overlay">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-verified">
                Revenge complete
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-text-primary">
                {revengeResult.title}
              </div>
              <div className="mt-1 font-mono text-xs text-text-secondary">
                {revengeResultLabel(revengeResult)}
              </div>
              {revengeResult.improved ? (
                <div className="mt-0.5 text-xs text-verified">
                  Beat your own failure.
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-text-tertiary">
                  Solved. Durations were not both recorded, so there is no speed to claim.
                </div>
              )}
            </div>
            <button
              onClick={() => setRevengeResult(null)}
              className="shrink-0 rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/practice/${revengeResult.problemSlug}#explain`}
              onClick={() => setRevengeResult(null)}
              className="rounded-md border border-hairline bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:brightness-110"
            >
              Write up what changed
            </Link>
            <Link
              href="/practice"
              onClick={() => setRevengeResult(null)}
              className="rounded-md border border-hairline bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:brightness-110"
            >
              Next battle
            </Link>
          </div>
        </div>
      )}

      {/* ── I'm Stuck ladder (Step 18). Real request, four levels, enforced. ── */}
      {stuckOpen && activeProblem && (
        <StuckLadder
          problemSlug={activeProblem.slug}
          problemTitle={activeProblem.title}
          battleId={battleId}
          squadId={profile?.active_squad_id ?? null}
          attemptCount={attemptCount}
          hasScratchpad={scratchpadNote.trim().length > 0}
          onClose={() => setStuckOpen(false)}
        />
      )}

      {/* ── Scratchpad Popover ─────────────────────────── */}
      {isScratchpadOpen && activeProblem && (
        <div className="popover-panel fixed bottom-24 right-6 z-[150] w-96 max-w-[calc(100vw-3rem)] p-4">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <span className="pl-1 text-xs font-semibold text-text-primary">
              Notes • {activeProblem.title}
            </span>
            <button
              onClick={() => setIsScratchpadOpen(false)}
              className="rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={scratchpadNote}
              onChange={(e) => handleSaveNote(e.target.value)}
              placeholder="Write your intuition, time/space complexity, or edge cases..."
              rows={4}
              className="w-full resize-none rounded-md border border-hairline bg-well p-2.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between pl-1 text-xs text-text-tertiary">
              <span>Saved on this device for this problem</span>
              <button
                onClick={() => setIsScratchpadOpen(false)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-on-primary transition-colors hover:bg-primary-hover"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Solve dock S1 (active) / idle one-liner ── */}
      {sessionExpired && activeProblem && (
        <div className="solve-dock-wrap select-none">
          <div className="card flex items-center justify-between gap-3 border border-error/30">
            <p className="text-sm leading-6 text-text-primary">
              Session expired, restart the battle to keep time honestly.
            </p>
            <button
              onClick={() => {
                setSessionExpired(false);
                clearBattle();
              }}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Restart battle
            </button>
          </div>
        </div>
      )}
      <div className="solve-dock-wrap select-none">
        {activeProblem ? (
          <>
            {/* Desktop S1 dock */}
            <div className="solve-dock hidden justify-between md:flex" aria-busy={submitting}>
              <div className="flex shrink-0 items-center gap-3 pl-1">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    isPlaying ? "animate-gold-pulse bg-primary" : "bg-text-tertiary"
                  )}
                  aria-hidden
                />
                <span className="font-mono text-xl font-medium leading-none tracking-tight text-text-primary tnum">
                  {formatTime(elapsedSec)}
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2.5 px-3">
                {saveError ? (
                  <span role="alert" className="truncate text-sm font-medium text-error">
                    {saveError}
                  </span>
                ) : (
                  <>
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {activeProblem.title}
                    </span>
                    {activeProblem.difficulty && (
                      <DifficultyBadgeNew difficulty={activeProblem.difficulty} size="sm" />
                    )}
                    <span className="hidden shrink-0 font-mono text-xs text-text-tertiary tnum lg:block">
                      No. {activeProblem.id}
                    </span>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
                  className="flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                  title="Open scratchpad for this problem"
                >
                  Notes
                </button>
                <button
                  onClick={() => setStuckOpen((v) => !v)}
                  className="flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-pattern transition-colors hover:bg-pattern-tint"
                  title="Open the Stuck hint ladder"
                >
                  Stuck?
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                  aria-label={isPlaying ? "Pause battle" : "Resume battle"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
                <ProblemLink
                  slug={activeProblem.slug}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                />
                <button
                  onClick={() => handleComplete()}
                  disabled={submitting || !canEnd}
                  className="h-9 min-w-[112px] rounded-md bg-primary px-4 text-[13px] font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-wait disabled:bg-surface-overlay disabled:text-text-secondary"
                >
                  {submitting ? "Saving…" : saveError ? "Retry solve" : "Submit solve"}
                </button>
                <BattleMenu
                  onFail={handleFail}
                  onAbandon={handleAbandon}
                  onReset={() => resetSolving()}
                  busy={submitting || !canEnd}
                />
              </div>
            </div>

            {/* Mobile S3 capsule: the timer stays in reach; the title opens the rest. */}
            <div className="pointer-events-auto relative w-full max-w-[360px] md:hidden">
              {capsuleMenuOpen && (
                <div className="popover-panel absolute bottom-[56px] left-0 right-0 flex flex-col p-2">
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      setIsScratchpadOpen(true);
                    }}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      setStuckOpen(true);
                    }}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-pattern hover:bg-pattern-tint"
                  >
                    Stuck?
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      setIsPlaying(!isPlaying);
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      handleFail();
                    }}
                    disabled={submitting || !canEnd}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                  >
                    Mark failed
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      handleAbandon();
                    }}
                    disabled={submitting || !canEnd}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                  >
                    Abandon
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      resetSolving();
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset timer
                  </button>
                </div>
              )}
              <div className="solve-capsule" aria-busy={submitting}>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    isPlaying ? "animate-gold-pulse bg-primary" : "bg-text-tertiary"
                  )}
                  aria-hidden
                />
                <span className="shrink-0 font-mono text-[15px] font-medium text-text-primary tnum">
                  {formatTime(elapsedSec)}
                </span>
                <button
                  type="button"
                  onClick={() => setCapsuleMenuOpen((v) => !v)}
                  aria-expanded={capsuleMenuOpen}
                  aria-label={`${activeProblem.title}: battle options`}
                  className={cn(
                    "flex min-h-[44px] min-w-0 flex-1 items-center justify-center truncate px-1 text-sm",
                    saveError ? "text-error" : "text-text-secondary"
                  )}
                >
                  <span className="truncate" role={saveError ? "alert" : undefined}>
                    {saveError ? "Not saved, tap ✓ to retry" : activeProblem.title}
                  </span>
                </button>
                <button
                  onClick={() => handleComplete()}
                  disabled={submitting || !canEnd}
                  aria-label={submitting ? "Saving solve" : saveError ? "Retry solve" : "Submit solve"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-wait disabled:bg-surface-overlay disabled:text-text-secondary"
                >
                  {submitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  ) : (
                    <Check className="h-5 w-5" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : outcome ? (
          <>
            {/* The battle just ended: say how, then step aside for the idle dock. */}
            <div
              role="status"
              aria-live="polite"
              className="solve-dock solve-dock-idle hidden justify-between gap-3 pl-4 pr-2 md:flex"
            >
              <span className="flex min-w-0 items-center gap-3 text-sm">
                {outcome.kind === "solved" ? (
                  <Check className="h-4 w-4 shrink-0 text-verified" strokeWidth={2.25} aria-hidden />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
                )}
                <span className={cn("shrink-0 font-medium", outcome.kind === "solved" ? "text-verified" : "text-text-secondary")}>
                  {outcome.kind === "solved" ? "Solved" : "Attempt logged"}
                </span>
                <span className="truncate text-text-primary">{outcome.title}</span>
                <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                  {formatTime(outcome.seconds)}
                </span>
              </span>
              <button
                onClick={() => {
                  setOutcome(null);
                  onSearchOpen?.();
                }}
                className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
              >
                Next battle
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div role="status" aria-live="polite" className="solve-capsule md:hidden">
              {outcome.kind === "solved" ? (
                <Check className="h-4 w-4 shrink-0 text-verified" strokeWidth={2.25} aria-hidden />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
              )}
              <span className={cn("shrink-0 text-sm font-medium", outcome.kind === "solved" ? "text-verified" : "text-text-secondary")}>
                {outcome.kind === "solved" ? "Solved" : "Attempt logged"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{outcome.title}</span>
              <span className="shrink-0 pr-3 font-mono text-xs text-text-tertiary tnum">
                {formatTime(outcome.seconds)}
              </span>
            </div>
          </>
        ) : (
          <div className="solve-dock solve-dock-idle hidden justify-between pl-4 pr-2 md:flex">
            <span className="flex items-center gap-3 text-sm text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-text-tertiary" aria-hidden />
              No battle running
            </span>
            <button
              onClick={onSearchOpen}
              className="flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
            >
              Pick a problem
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** The dock's overflow: the battle endings that aren't a solve. */
function BattleMenu({
  onFail,
  onAbandon,
  onReset,
  busy,
}: {
  onFail: () => void;
  onAbandon: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  // Controlled, not <details>: a native disclosure stayed open after a choice,
  // so the menu hung over the dock once the battle had already ended.
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More battle options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {open && (
        <div role="menu" className="popover-panel absolute bottom-11 right-0 flex w-44 flex-col p-2">
          <button
            role="menuitem"
            onClick={choose(onFail)}
            disabled={busy}
            className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
          >
            Mark failed
          </button>
          <button
            role="menuitem"
            onClick={choose(onAbandon)}
            disabled={busy}
            className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
          >
            Abandon
          </button>
          <button
            role="menuitem"
            onClick={choose(onReset)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset timer
          </button>
        </div>
      )}
    </div>
  );
}
