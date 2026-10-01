"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  X,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { difficultyBadgeClass } from "@/components/ui/DifficultyBadge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import {
  useSolving,
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
    seconds,
    setSeconds,
    startedAt,
  } = useSolving();

  // Elapsed time derived from wall clock, not accumulated ticks: a backgrounded
  // tab or a throttled interval must not make the timer drift (Step 7 honesty).
  const elapsedSec = useMemo(() => {
    if (startedAt == null) return seconds;
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  }, [seconds, startedAt]);

  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  // Step 17: closes the "failed -> solved" loop with the real before/after.
  const [revengeResult, setRevengeResult] = useState<RevengeResult | null>(null);
  // Feeds the ladder's suggested level: how many tries have you already had?
  const [attemptCount, setAttemptCount] = useState(1);

  // Load scratchpad note whenever activeProblem changes
  useEffect(() => {
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

  // Stopwatch interval. Ticks only to re-render; elapsedSec comes from the clock.
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && activeProblem) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, activeProblem, setSeconds]);

  const handleSaveNote = (text: string) => {
    setScratchpadNote(text);
    if (activeProblem?.slug) {
      localStorage.setItem(`mahayuddh_notes_${activeProblem.slug}`, text);
      // Mirror to server session (debounced by keystroke batching upstream).
      if (battleId) heartbeatBattle(battleId, { scratchpad_md: text.slice(0, 20000) }).catch(() => {});
    }
  };

  // Heartbeat duration every 15s while solving (plan Step 7: persist every 15s).
  // Sends the real elapsed time computed from the wall clock, never a guess.
  useEffect(() => {
    if (!isPlaying || !battleId) return;
    const send = () => {
      const real = Math.max(0, Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000));
      heartbeatBattle(battleId, { duration_sec: real }).catch(() => {});
    };
    send();
    const t = setInterval(send, 15000);
    return () => clearInterval(t);
  }, [isPlaying, battleId, startedAt]);

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
        endBattle(battleId, "solved", { duration_sec: elapsedSec, evidence }).catch(() => {});
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
        colors: ["#fa586a", "#30d158", "#ffd60a", "#0a84ff"],
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
        await endBattle(battleId, "failed", { duration_sec: elapsedSec }).catch(() => {});
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
    if (battleId) await endBattle(battleId, "abandoned", { duration_sec: elapsedSec }).catch(() => {});
    setBattleId(null);
    setActiveProblem(null);
    setIsPlaying(false);
    setStuckOpen(false);
  }, [activeProblem, battleId, elapsedSec, setActiveProblem, setIsPlaying]);

  // Background auto-detection: check if active problem was accepted on LeetCode while solving
  useEffect(() => {
    if (!isPlaying || !activeProblem?.slug || !profile?.leetcode_username) return;

    const interval = setInterval(async () => {
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
        <div className="fixed bottom-[calc(var(--bottom-bar-height)+var(--bottom-bar-margin)+14px)] left-1/2 -translate-x-1/2 w-[26rem] max-w-[calc(100vw-2rem)] z-[160] rounded-3xl bg-[#1c1c1e]/95 backdrop-blur-2xl border border-[#30d158]/30 shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#30d158]">
                Revenge complete
              </div>
              <div className="text-sm font-bold text-white mt-0.5 truncate">
                {revengeResult.title}
              </div>
              <div className="text-[11px] text-white/60 font-mono mt-1">
                {revengeResultLabel(revengeResult)}
              </div>
              {revengeResult.improved ? (
                <div className="text-[11px] text-[#30d158] mt-0.5">
                  Beat your own failure.
                </div>
              ) : (
                /* No fake speedup when either duration is missing (§44). */
                <div className="text-[11px] text-white/35 mt-0.5">
                  Solved. Durations were not both recorded, so there is no speed to claim.
                </div>
              )}
            </div>
            <button
              onClick={() => setRevengeResult(null)}
              className="p-1 text-white/40 hover:text-white rounded-md transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/practice/${revengeResult.problemSlug}#explain`}
              onClick={() => setRevengeResult(null)}
              className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all"
            >
              Write up what changed
            </Link>
            <Link
              href="/practice"
              onClick={() => setRevengeResult(null)}
              className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all"
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
        <div className="fixed bottom-[calc(var(--bottom-bar-height)+var(--bottom-bar-margin)+12px)] right-6 w-96 max-w-[calc(100vw-3rem)] bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[150] p-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white pl-1">
              Notes • {activeProblem.title}
            </span>
            <button
              onClick={() => setIsScratchpadOpen(false)}
              className="p-1 text-white/40 hover:text-white rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={scratchpadNote}
              onChange={(e) => handleSaveNote(e.target.value)}
              placeholder="Write your intuition, time/space complexity, or edge cases..."
              rows={4}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 resize-none font-mono"
            />
            <div className="mt-2 flex justify-between items-center text-[10px] text-white/30 pl-1">
              <span>Saved locally for this problem</span>
              <button
                onClick={() => setIsScratchpadOpen(false)}
                className="px-3 py-1 bg-[#fa586a] text-white rounded-full font-medium text-xs hover:opacity-90 transition-opacity cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Centered Compact Floating Dock (Apple Music Chrome Player) ── */}
      <div className="floating-bottom-dock-container select-none">
        <div className="floating-bottom-bar">
          {/* Left: Timer Controls */}
          <div className="flex items-center gap-2 pl-1.5 shrink-0">
            <button
              onClick={() => setSeconds(0)}
              disabled={!activeProblem}
              className="p-1.5 rounded-full text-white/35 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Reset Timer"
              aria-label="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                if (!activeProblem) {
                  if (onSearchOpen) onSearchOpen();
                  return;
                }
                setIsPlaying(!isPlaying);
              }}
              className="w-8 h-8 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center shadow-subtle transition-transform active:scale-95 cursor-pointer"
              aria-label={isPlaying ? "Pause Timer" : "Start Timer"}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <div className="flex flex-col ml-0.5">
              <span className="font-mono text-[11px] font-bold text-white tracking-wider">
                {formatTime(elapsedSec)}
              </span>
              <span className="text-[9px] text-white/35 uppercase tracking-wider font-semibold">
                {activeProblem ? (isPlaying ? "Solving" : "Paused") : "Idle"}
              </span>
            </div>
          </div>

          {/* Center: Problem Metadata (LCD Track Info) */}
          <div className="flex items-center justify-center gap-2.5 flex-1 min-w-0 mx-2 truncate px-2">
            {activeProblem ? (
              <>
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 font-mono text-[10px] font-bold text-white/80">
                  #{activeProblem.id}
                </div>

                <div className="flex flex-col truncate min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[12px] font-semibold text-white truncate">
                      {activeProblem.title}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[9px] font-semibold border shrink-0",
                        difficultyBadgeClass(activeProblem.difficulty)
                      )}
                    >
                      {activeProblem.difficulty}
                    </span>
                  </div>
                  <div className="text-[9px] text-white/35 truncate">
                    {activeProblem.category ? `${activeProblem.category} • ` : ""}
                    {isPlaying ? "Session in progress" : "Session paused"}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center text-white/35 text-[11px] truncate">
                <span>No problem active • Select a problem to solve</span>
              </div>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-1.5 pr-1.5 shrink-0">
            {activeProblem ? (
              <>
                {/* Scratchpad */}
                <button
                  onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors hidden sm:flex items-center cursor-pointer",
                    isScratchpadOpen
                      ? "bg-white/[0.1] border-white/[0.14] text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  Notes
                </button>

                {/* LeetCode Link */}
                <ProblemLink
                  slug={activeProblem.slug}
                  className="p-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06]"
                />

                {/* I'm Stuck */}
                <button
                  onClick={() => setStuckOpen((v) => !v)}
                  title="Stuck? Get the smallest useful hint."
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors cursor-pointer hidden sm:block",
                    stuckOpen
                      ? "bg-[#ff9f0a]/15 border-[#ff9f0a]/40 text-[#ff9f0a]"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  Stuck?
                </button>

                {/* Mark Failed */}
                <button
                  onClick={handleFail}
                  disabled={ending}
                  title="Couldn't crack it — records an honest attempt for revenge later."
                  className="px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-white/40 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
                >
                  Failed
                </button>

                {/* Mark Solved */}
                <button
                  onClick={() => handleComplete()}
                  disabled={isCompleted}
                  className={cn(
                    "px-3 py-1 rounded-full font-semibold text-[11px] transition-all cursor-pointer",
                    isCompleted
                      ? "bg-[#30d158] text-black"
                      : "bg-[#fa586a] hover:bg-[#fa586a]/90 text-white shadow-glow"
                  )}
                >
                  {isCompleted ? "Solved" : "Mark Solved"}
                </button>

                {/* Abandon */}
                <button
                  onClick={handleAbandon}
                  title="Abandon battle (nothing recorded)"
                  aria-label="Abandon battle"
                  className="p-1.5 rounded-full text-white/25 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={onSearchOpen}
                className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Find Problem
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
