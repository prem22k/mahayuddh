"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { X, Send, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { createStuckRequest } from "@/lib/data/stuck";
import {
  STUCK_LEVELS,
  LEVEL_LABEL,
  LEVEL_PROMISE,
  LEVEL_EXAMPLE,
  LEVEL_CLASS,
  VISIBILITY_LABEL,
  suggestLevel,
} from "@/lib/stuckLadder";
import type { StuckLevel, StuckVisibility } from "@/types/database";

/**
 * I'm Stuck ladder (Step 18, Bible §12).
 *
 * The user picks how much help they want; that choice is a contract the
 * database enforces on the people who answer. Asking for less is the point —
 * a nudge you can act on teaches more than an answer that teaches nothing.
 */
export function StuckLadder({
  problemSlug,
  problemTitle,
  battleId,
  squadId,
  attemptCount,
  hasScratchpad,
  onClose,
}: {
  problemSlug: string;
  problemTitle: string;
  battleId?: string | null;
  squadId?: string | null;
  attemptCount?: number;
  hasScratchpad?: boolean;
  onClose: () => void;
}) {
  const [level, setLevel] = useState<StuckLevel>(
    suggestLevel(attemptCount ?? 1, Boolean(hasScratchpad))
  );
  const [visibility, setVisibility] = useState<StuckVisibility>("squad");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const submit = useCallback(async () => {
    setPosting(true);
    setError(null);
    const res = await createStuckRequest({
      problemSlug,
      level,
      visibility,
      battleId: battleId ?? null,
      squadId,
    });
    setPosting(false);
    if (res.ok) {
      setPosted(true);
      track("stuck_requested", { problem_slug: problemSlug, level, visibility, posted: true });
      setTimeout(onClose, 1200);
    } else {
      setError(res.error);
    }
  }, [problemSlug, level, visibility, battleId, squadId, onClose]);

  if (posted) {
    return (
      <div className="fixed bottom-[calc(var(--bottom-bar-height)+var(--bottom-bar-margin)+12px)] left-1/2 -translate-x-1/2 w-[26rem] max-w-[calc(100vw-2rem)] bg-[#1c1c1e]/95 backdrop-blur-2xl border border-[#30d158]/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[150] p-5 text-center">
        <div className="text-sm font-bold text-white">Asked for {LEVEL_LABEL[level].toLowerCase()}</div>
        <p className="text-[11px] text-white/50 mt-1">
          Your squad can reply at {level === "full" ? "any" : `${level} or less`}. Keep thinking —
          that is the point.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[calc(var(--bottom-bar-height)+var(--bottom-bar-margin)+12px)] left-1/2 -translate-x-1/2 w-[26rem] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[150] p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <span className="text-xs font-bold text-white pl-1">
          Stuck on {problemTitle} — how much help?
        </span>
        <button
          onClick={onClose}
          className="p-1 text-white/55 hover:text-white rounded-md transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-white/60">
        Least help that unsticks you. Helpers may not give more than you ask for.
      </p>

      <div className="space-y-1.5">
        {STUCK_LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={cn(
              "w-full text-left p-3 rounded-2xl border transition-colors cursor-pointer",
              level === l
                ? "border-white/25 bg-white/[0.07]"
                : "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                  LEVEL_CLASS[l]
                )}
              >
                {LEVEL_LABEL[l]}
              </span>
              {level === l && <span className="text-[10px] text-white/55">selected</span>}
            </div>
            <div className="text-[11px] text-white/60 mt-1.5">{LEVEL_PROMISE[l]}</div>
            <div className="text-[11px] text-white/50 italic mt-1">{LEVEL_EXAMPLE[l]}</div>
          </button>
        ))}
      </div>

      <div>
        <div className="text-[10px] font-bold text-white/55 uppercase tracking-wider mb-1.5">
          Who can see this
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(["squad", "public", "anon"] as StuckVisibility[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              title={VISIBILITY_LABEL[v]}
              className={cn(
                "px-2 py-2 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer",
                visibility === v
                  ? "bg-white/[0.12] border-white/25 text-white"
                  : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white/75"
              )}
            >
              {v === "anon" ? "Anonymous" : v === "squad" ? "My squad" : "Public"}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/50 mt-1.5">{VISIBILITY_LABEL[visibility]}</p>
      </div>

      {/* Escape hatches that teach rather than hand over an answer, plus a way
          to reach the board — asking is not a dead end. */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/[0.06]">
        <Link
          href={`/practice/${problemSlug}`}
          onClick={onClose}
          className="text-[11px] text-white/50 hover:text-white flex items-center gap-1.5"
        >
          <HelpCircle className="w-3 h-3" />
          Re-read the problem
        </Link>
        <span className="text-white/15 text-[11px]">·</span>
        <Link
          href="/practice"
          onClick={onClose}
          className="text-[11px] text-white/50 hover:text-white"
        >
          Browse the pattern
        </Link>
        <span className="text-white/15 text-[11px]">·</span>
        <Link href="/stuck" className="text-[11px] text-white/50 hover:text-white">
          Squad requests
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-[#ff453a]">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={posting}
        className="w-full py-2.5 rounded-full bg-[#ff9f0a] hover:bg-[#ff9f0a]/90 text-black text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
      >
        <Send className="w-3.5 h-3.5" />
        {posting ? "Posting…" : `Ask for ${LEVEL_LABEL[level].toLowerCase()}`}
      </button>
    </div>
  );
}