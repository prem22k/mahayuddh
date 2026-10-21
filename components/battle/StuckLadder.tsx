"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { X, Send, CircleHelp, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { createStuckRequest } from "@/lib/data/stuck";
import { Button } from "@/components/ui/Button";
import {
  STUCK_LEVELS,
  LEVEL_LABEL,
  LEVEL_PROMISE,
  LEVEL_EXAMPLE,
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
      <div
        role="status"
        className="fixed bottom-24 left-1/2 z-[150] flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-hairline-strong bg-surface-raised p-4 shadow-overlay"
      >
        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-pattern" strokeWidth={1.5} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-text-primary">
            Asked for {LEVEL_LABEL[level].toLowerCase()}
          </p>
          <p className="mt-0.5 text-xs leading-4 text-text-secondary">
            Your squad can reply at {level === "full" ? "any" : `${level} or less`}. Keep thinking —
            that is the point.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={`Stuck on ${problemTitle}`}
      className="fixed bottom-24 left-1/2 z-[150] flex max-h-[70vh] w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-hairline-strong bg-surface-raised p-4 shadow-overlay"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
            Stuck on
          </span>
          <p className="truncate text-[15px] font-semibold leading-6 text-text-primary">{problemTitle}</p>
          <p className="mt-0.5 text-xs leading-4 text-text-secondary">
            Least help that unsticks you. Helpers may not give more than you ask for.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary md:h-8 md:w-8"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
          How much help
        </span>
        <div className="flex flex-col gap-1.5" role="group" aria-label="Help level">
          {STUCK_LEVELS.map((l, i) => {
            const selected = level === l;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={selected}
                onClick={() => setLevel(l)}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors",
                  selected
                    ? "border-pattern/30 bg-pattern-tint/40"
                    : "border-hairline bg-surface hover:border-hairline-strong hover:bg-surface-overlay"
                )}
              >
                <span
                  className={cn(
                    "mt-px w-4 shrink-0 font-mono text-sm font-medium tnum",
                    selected ? "text-pattern" : "text-text-tertiary"
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold leading-5",
                        selected ? "text-pattern" : "text-text-primary"
                      )}
                    >
                      {LEVEL_LABEL[l]}
                    </span>
                    {selected && (
                      <span className="shrink-0 rounded-xs bg-pattern/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-3 text-pattern">
                        SELECTED
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-text-secondary">
                    {LEVEL_PROMISE[l]}
                  </span>
                  <span className="mt-1 block text-xs italic leading-snug text-text-tertiary">
                    {LEVEL_EXAMPLE[l]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
          Who can see this
        </span>
        <div
          role="group"
          aria-label="Who can see this"
          className="grid grid-cols-3 gap-1 rounded-md border border-hairline bg-well p-1"
        >
          {(["squad", "public", "anon"] as StuckVisibility[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={visibility === v}
              onClick={() => setVisibility(v)}
              title={VISIBILITY_LABEL[v]}
              className={cn(
                "flex min-h-[44px] cursor-pointer items-center justify-center rounded-sm px-2 py-1.5 text-xs font-medium leading-4 transition-colors md:min-h-0",
                visibility === v
                  ? "bg-surface-overlay text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {v === "anon" ? "Anonymous" : v === "squad" ? "My squad" : "Public"}
            </button>
          ))}
        </div>
        <p className="px-1 text-xs leading-4 text-text-tertiary">{VISIBILITY_LABEL[visibility]}</p>
      </div>

      {/* Escape hatches that teach rather than hand over an answer, plus a way
          to reach the board — asking is not a dead end. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline pt-3 text-xs leading-4">
        <Link
          href={`/practice/${problemSlug}`}
          onClick={onClose}
          className="flex min-h-[32px] items-center gap-1.5 text-text-tertiary transition-colors hover:text-text-primary"
        >
          <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Re-read the problem
        </Link>
        <span className="text-text-disabled" aria-hidden>·</span>
        <Link
          href="/practice"
          onClick={onClose}
          className="flex min-h-[32px] items-center text-text-tertiary transition-colors hover:text-text-primary"
        >
          Browse the pattern
        </Link>
        <span className="text-text-disabled" aria-hidden>·</span>
        <Link
          href="/stuck"
          className="flex min-h-[32px] items-center text-text-tertiary transition-colors hover:text-text-primary"
        >
          Squad requests
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-xs leading-4 text-error">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="full"
        onClick={submit}
        disabled={posting}
        className="min-h-[44px] font-semibold md:min-h-0"
      >
        <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        {posting ? "Posting…" : `Ask for ${LEVEL_LABEL[level].toLowerCase()}`}
      </Button>
    </div>
  );
}
