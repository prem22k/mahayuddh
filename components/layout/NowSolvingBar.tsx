"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  FileText,
  Users,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn, formatTime } from "@/lib/utils";

interface ActiveProblem {
  id: string;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
}

export function NowSolvingBar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(1455); // 24m 15s default
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState("");
  const [activeProblem] = useState<ActiveProblem>({
    id: "15",
    title: "3Sum",
    slug: "3sum",
    difficulty: "Medium",
    category: "Two Pointers",
  });
  const [isCompleted, setIsCompleted] = useState(false);

  // Stopwatch interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const handleComplete = () => {
    setIsCompleted(true);
    setIsPlaying(false);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.9 },
      colors: ["#fa586a", "#30d158", "#ffd60a", "#0a84ff"],
    });
    setTimeout(() => setIsCompleted(false), 4000);
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
      case "easy":
        return "text-apple-green bg-apple-green/10 border-apple-green/30";
      case "medium":
        return "text-apple-orange bg-apple-orange/10 border-apple-orange/30";
      case "hard":
        return "text-apple-red bg-apple-red/10 border-apple-red/30";
      default:
        return "text-txt-secondary";
    }
  };

  return (
    <>
      {/* Scratchpad Drawer Modal */}
      {isScratchpadOpen && (
        <div className="fixed bottom-20 right-6 w-96 max-w-[calc(100vw-3rem)] bg-surface-strong/95 backdrop-blur-2xl border border-border-strong rounded-2xl shadow-modal z-50 p-4 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-apple-accent" />
              <span className="text-xs font-semibold text-txt-primary">
                Intuition & Scratchpad Note
              </span>
            </div>
            <button
              onClick={() => setIsScratchpadOpen(false)}
              className="p-1 text-txt-secondary hover:text-txt-primary rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={scratchpadNote}
              onChange={(e) => setScratchpadNote(e.target.value)}
              placeholder="Write your 3-line approach / intuition before coding..."
              rows={4}
              className="w-full bg-surface-muted border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-apple-accent resize-none font-mono"
            />
            <div className="mt-2 flex justify-between items-center text-[10px] text-txt-secondary">
              <span>Saved locally to active solve session</span>
              <button
                onClick={() => setIsScratchpadOpen(false)}
                className="px-2.5 py-1 bg-apple-accent text-white rounded-md font-medium text-xs hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The Bottom Player Bar */}
      <div className="h-16 fixed bottom-0 left-0 right-0 glass-panel border-t border-border-subtle z-40 px-4 md:px-8 flex items-center justify-between">
        {/* Left: Stopwatch & Media Controls */}
        <div className="flex items-center gap-3 w-1/4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSeconds(0)}
              className="p-2 rounded-full text-txt-secondary hover:text-txt-primary hover:bg-surface-raised transition-colors"
              title="Reset Timer"
              aria-label="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-9 h-9 rounded-full bg-txt-primary hover:bg-white text-surface-base flex items-center justify-center shadow-subtle transition-transform active:scale-95"
              aria-label={isPlaying ? "Pause Timer" : "Start Timer"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-txt-primary tracking-wider">
              {formatTime(seconds)}
            </span>
            <span className="text-[10px] text-txt-secondary uppercase tracking-wider font-semibold">
              {isPlaying ? "Solving Now" : "Session Paused"}
            </span>
          </div>
        </div>

        {/* Center: Active Problem Info (Album Art / Track metadata style) */}
        <div className="flex items-center justify-center gap-3.5 flex-1 max-w-xl mx-auto truncate px-2">
          {/* Thumbnail / Difficulty Pill */}
          <div className="w-10 h-10 rounded-lg bg-surface-muted border border-border-subtle flex flex-col items-center justify-center shrink-0">
            <span className="text-[9px] font-mono text-txt-tertiary">#</span>
            <span className="text-xs font-bold text-txt-primary">{activeProblem.id}</span>
          </div>

          {/* Title & Friend Presence */}
          <div className="flex flex-col truncate">
            <div className="flex items-center gap-2 truncate">
              <span className="text-[13px] font-semibold text-txt-primary truncate">
                {activeProblem.title}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                  getDifficultyBadge(activeProblem.difficulty)
                )}
              >
                {activeProblem.difficulty}
              </span>
              <span className="text-xs text-txt-tertiary hidden lg:inline">• {activeProblem.category}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-txt-secondary truncate mt-0.5">
              <Users className="w-3 h-3 text-apple-accent" />
              <span>Rahul & Arjun are also solving this</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center justify-end gap-2.5 w-1/4">
          {/* Scratchpad Button */}
          <button
            onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
            className={cn(
              "p-2 rounded-lg border text-xs font-medium transition-colors hidden sm:flex items-center gap-1.5",
              isScratchpadOpen
                ? "bg-surface-strong border-border-strong text-txt-primary"
                : "bg-surface-muted border-border-subtle text-txt-secondary hover:text-txt-primary hover:bg-surface-raised"
            )}
            title="Open Notes Scratchpad"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="text-[11px]">Notes</span>
          </button>

          {/* External LeetCode Link */}
          <a
            href={`https://leetcode.com/problems/${activeProblem.slug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-surface-muted hover:bg-surface-raised border border-border-subtle text-txt-secondary hover:text-txt-primary transition-colors"
            title="Open on LeetCode"
            aria-label="Open on LeetCode"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Mark as Solved / Verified */}
          <button
            onClick={handleComplete}
            disabled={isCompleted}
            className={cn(
              "px-3 py-1.5 rounded-pill font-semibold text-xs transition-all flex items-center gap-1.5",
              isCompleted
                ? "bg-apple-green text-surface-base"
                : "bg-apple-accent hover:opacity-90 text-white shadow-glow"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isCompleted ? "Solved! 🎉" : "Mark Solved"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
