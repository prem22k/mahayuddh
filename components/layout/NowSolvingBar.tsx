"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  X,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { toggleProblemStatus } from "@/lib/data/sheets";

interface NowSolvingBarProps {
  onSearchOpen?: () => void;
}

export function NowSolvingBar({ onSearchOpen }: NowSolvingBarProps) {
  const { user, profile } = useAuth();
  const {
    activeProblem,
    isPlaying,
    setIsPlaying,
    seconds,
    setSeconds,
  } = useSolving();

  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  // Load scratchpad note whenever activeProblem changes
  useEffect(() => {
    if (activeProblem?.slug) {
      const savedNote = localStorage.getItem(`mahayuddh_notes_${activeProblem.slug}`) || "";
      setScratchpadNote(savedNote);
    } else {
      setScratchpadNote("");
    }
  }, [activeProblem?.slug]);

  // Stopwatch interval
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
    }
  };

  const handleComplete = useCallback(async () => {
    if (!activeProblem) return;
    setIsCompleted(true);
    setIsPlaying(false);

    if (user) {
      try {
        await toggleProblemStatus(user.id, activeProblem.slug, true);
        // Notify open sheet views so their solved status refreshes immediately.
        window.dispatchEvent(
          new CustomEvent("problem-status-changed", {
            detail: { slug: activeProblem.slug, status: "solved" },
          })
        );
      } catch (err) {
        console.error("Error marking problem as solved in Supabase:", err);
      }
    }

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
  }, [activeProblem, setIsPlaying, user]);

  // Background auto-detection: check if active problem was accepted on LeetCode while solving
  useEffect(() => {
    if (!isPlaying || !activeProblem?.slug || !profile?.leetcode_username) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/sync/leetcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: profile.leetcode_username }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const activeSlug = activeProblem.slug.toLowerCase();
        const isAc = (data?.recentSubmissions || []).some(
          (s: { titleSlug: string }) => s.titleSlug?.toLowerCase() === activeSlug
        );
        if (isAc) {
          handleComplete();
        }
      } catch {
        // silent fail
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [isPlaying, activeProblem?.slug, profile?.leetcode_username, handleComplete]);

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/25";
      case "medium":
        return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/25";
      case "hard":
        return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/25";
      default:
        return "text-white/40";
    }
  };

  return (
    <>
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
                {formatTime(seconds)}
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
                        getDifficultyBadge(activeProblem.difficulty)
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
                <a
                  href={`https://leetcode.com/problems/${activeProblem.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/40 hover:text-white transition-colors"
                  title="Open on LeetCode"
                  aria-label="Open on LeetCode"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {/* Mark Solved */}
                <button
                  onClick={handleComplete}
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
