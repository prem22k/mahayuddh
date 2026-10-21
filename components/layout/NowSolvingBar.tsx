"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export function NowSolvingBar({ onSearchOpen }: NowSolvingBarProps) {
  const { user, profile, session } = useAuth();
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
  const [isCompleted, setIsCompleted] = useState(false);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [ending, setEnding] = useState(false);
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
      setIsCompleted(false);
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
          const raw = localStorage.getItem("mahayuddh_battle_slug");
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
              localStorage.setItem("mahayuddh_battle_slug", activeProblem.slug);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProblem?.slug]);

  // The per-second tick lives in the provider (performance.now()
  // accumulation); this component only re-renders from `seconds`.

  // Multi-tab leader election: only one tab heartbeats. Tabs announce over a
  // BroadcastChannel and the lowest id wins; others suppress heartbeats but
  // keep counting locally so a leader handoff never loses time.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      setIsHeartbeatLeader(true);
      return;
    }
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const peers = new Set<string>([tabId]);
    let closed = false;
    const channel = new BroadcastChannel("mahayuddh_battle_heartbeat");
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
        channel.postMessage({ type: "hello", id: tabId });
        elect();
      } else if (msg.type === "bye") {
        peers.delete(msg.id);
        elect();
      }
    };
    channel.postMessage({ type: "hello", id: tabId });
    const ping = setInterval(() => {
      if (!closed) channel.postMessage({ type: "ping", id: tabId });
    }, 5000);
    const t = setTimeout(elect, 600);
    const onUnload = () => {
      try {
        channel.postMessage({ type: "bye", id: tabId });
      } catch {
        // ignore
      }
      channel.close();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(t);
      window.removeEventListener("beforeunload", onUnload);
      try {
        channel.postMessage({ type: "bye", id: tabId });
      } catch {
        // ignore
      }
      channel.close();
    };
  }, []);

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

  const handleComplete = useCallback(async (evidence: "leetcode" | "none" = "none") => {
    if (!activeProblem) return;

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
          .eq("problem_slug", activeProblem.slug.toLowerCase())
          .maybeSingle();
        wasSolved = (prev as { status: string } | null)?.status === "solved";
        saved = await toggleProblemStatus(user.id, activeProblem.slug, true);
      } catch (err) {
        console.error("Error marking problem as solved in Supabase:", err);
      }
      if (!saved) return;
      track("battle_solved", { problem_slug: activeProblem.slug });
      if (wasSolved) track("revisit_done", { problem_slug: activeProblem.slug, via: "dock" });
      if (battleId) {
        endBattle(battleId, "solved", { duration_sec: elapsedSec, evidence })
          .then((res) => {
            if (res.expired) {
              setSessionExpired(true);
              setIsPlaying(false);
            }
          })
          .catch(() => {});
      }
      logProblemEvent({
        problemSlug: activeProblem.slug,
        kind: wasSolved ? "revisited" : "solved",
        battleId,
        durationSec: elapsedSec,
        source: evidence === "leetcode" ? "leetcode" : "self",
      }).catch(() => {});
      // Squad activity: solves generate feed without requiring prose (§50).
      logFeedEvent({
        eventType: "solve",
        squadId: profile?.active_squad_id ?? null,
        problemTitle: activeProblem.title,
        problemSlug: activeProblem.slug,
        difficulty: activeProblem.difficulty,
        metadata: { duration_sec: elapsedSec, source: evidence },
      }).catch(() => {});

      // Revenge (Step 17): a solve that answers a recorded failure is a
      // different event from a solve — it closes a loop the user opened.
      if (battleId) {
        detectRevengeCompletion(activeProblem.slug, battleId, activeProblem.title)
          .then((result) => {
            if (!result) return;
            track("revenge_completed", {
              problem_slug: activeProblem.slug,
              improved: result.improved,
            });
            setRevengeResult(result);
          })
          .catch(() => {});
      }
      // Notify open sheet views so their solved status refreshes immediately.
      window.dispatchEvent(
        new CustomEvent("problem-status-changed", {
          detail: { slug: activeProblem.slug, status: "solved" },
        })
      );
    }

    setIsCompleted(true);
    setIsPlaying(false);

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

    setTimeout(() => setIsCompleted(false), 4000);
  }, [activeProblem, setIsPlaying, user, battleId, elapsedSec, profile?.active_squad_id]);

  const handleFail = useCallback(async () => {
    if (!activeProblem || !user) return;
    setEnding(true);
    try {
      // Failed ≠ unsolved: record an honest attempt, never downgrade a prior solve.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("user_problem_status")
        .select("status")
        .eq("user_id", user.id)
        .eq("problem_slug", activeProblem.slug.toLowerCase())
        .maybeSingle();
      if ((existing as { status: string } | null)?.status !== "solved") {
        await setProblemStatus(user.id, activeProblem.slug, "attempted");
        window.dispatchEvent(
          new CustomEvent("problem-status-changed", {
            detail: { slug: activeProblem.slug, status: "attempted" },
          })
        );
      }
      if (battleId) {
        await endBattle(battleId, "failed", { duration_sec: elapsedSec })
          .then((res) => {
            if (res.expired) {
              setSessionExpired(true);
              setIsPlaying(false);
            }
          })
          .catch(() => {});
      }
      await logProblemEvent({
        problemSlug: activeProblem.slug,
        kind: "failed",
        battleId,
        durationSec: elapsedSec,
      }).catch(() => {});
      track("battle_failed", { problem_slug: activeProblem.slug });
      // No feed event: failed battles stay private until revenge (Phase 3).
      setBattleId(null);
      setIsPlaying(false);
      setStuckOpen(false);
    } finally {
      setEnding(false);
    }
  }, [activeProblem, user, battleId, elapsedSec, setIsPlaying]);

  const handleAbandon = useCallback(async () => {
    if (!activeProblem) return;
    if (!window.confirm("Abandon this battle? The timer stops; nothing is recorded as attempted.")) return;
    if (battleId) {
      const res = await endBattle(battleId, "abandoned", { duration_sec: elapsedSec }).catch(() => null);
      if (res?.expired) setSessionExpired(true);
    }
    setBattleId(null);
    setActiveProblem(null);
    setIsPlaying(false);
    setStuckOpen(false);
  }, [activeProblem, battleId, elapsedSec, setActiveProblem, setIsPlaying]);

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
                setBattleId(null);
                resetSolving();
                setActiveProblem(null);
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
            <div className="solve-dock hidden justify-between md:flex">
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
                <span className="truncate text-sm font-semibold text-text-primary">
                  {activeProblem.title}
                </span>
                {activeProblem.difficulty && (
                  <DifficultyBadgeNew difficulty={activeProblem.difficulty} size="sm" />
                )}
                <span className="hidden shrink-0 font-mono text-xs text-text-tertiary tnum lg:block">
                  No. {activeProblem.id}
                </span>
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
                  disabled={isCompleted}
                  className="h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:bg-surface-overlay disabled:text-text-disabled"
                >
                  {isCompleted ? "Solved" : "Submit solve"}
                </button>
                <BattleMenu
                  onFail={handleFail}
                  onAbandon={handleAbandon}
                  onReset={() => resetSolving()}
                  ending={ending}
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
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={handleFail}
                    disabled={ending}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                  >
                    Mark failed
                  </button>
                  <button
                    onClick={handleAbandon}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    Abandon
                  </button>
                  <button
                    onClick={() => resetSolving()}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset timer
                  </button>
                </div>
              )}
              <div className="solve-capsule">
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
                  className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center truncate px-1 text-sm text-text-secondary"
                >
                  <span className="truncate">{activeProblem.title}</span>
                </button>
                <button
                  onClick={() => handleComplete()}
                  disabled={isCompleted}
                  aria-label={isCompleted ? "Solved" : "Submit solve"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:bg-surface-overlay disabled:text-text-disabled"
                >
                  <Check className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
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
  ending,
}: {
  onFail: () => void;
  onAbandon: () => void;
  onReset: () => void;
  ending: boolean;
}) {
  return (
    <details className="relative">
      <summary
        aria-label="More battle options"
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </summary>
      <div className="popover-panel absolute bottom-11 right-0 flex w-44 flex-col p-2">
        <button
          onClick={onFail}
          disabled={ending}
          className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
        >
          Mark failed
        </button>
        <button
          onClick={onAbandon}
          className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
        >
          Abandon
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset timer
        </button>
      </div>
    </details>
  );
}
