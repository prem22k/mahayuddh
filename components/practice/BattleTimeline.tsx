"use client";

import React from "react";
import { ArrowLeftRight, CircleCheck, CircleX, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { fmtDelta } from "@/components/practice/LatestResultCard";
import type { Battle, ProblemEvent, ProblemEventKind } from "@/types/database";

type Tone = "verified" | "error" | "pattern" | "neutral";

const KIND_LABEL: Record<ProblemEventKind, { label: string; tone: Tone }> = {
  solved: { label: "Solved", tone: "verified" },
  attempted: { label: "Attempted", tone: "neutral" },
  explained: { label: "Explained", tone: "pattern" },
  revisited: { label: "Revisited", tone: "verified" },
  challenge_completed: { label: "Challenge completed", tone: "verified" },
  failed: { label: "Failed", tone: "error" },
  stuck: { label: "Stuck", tone: "neutral" },
};

const TONE_CLS: Record<Tone, string> = {
  verified: "border-verified/30 bg-verified-tint text-verified",
  error: "border-error/30 bg-error-tint text-error",
  pattern: "border-pattern/30 bg-pattern-tint text-pattern",
  neutral: "border-hairline-strong bg-surface-overlay text-text-secondary",
};

/** Kinds where "how was this recorded" is a meaningful question. */
const EVIDENCE_KINDS = new Set<ProblemEventKind>([
  "solved",
  "revisited",
  "challenge_completed",
  "failed",
  "attempted",
]);

interface Entry {
  id: string;
  label: string;
  tone: Tone;
  at: string;
  durationSec: number | null;
  /** null when evidence does not apply to this kind of entry. */
  leetcode: boolean | null;
  solve: boolean;
  /** Your own scratchpad note on a failed battle. */
  note: string | null;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "Your battles": battles and logged events merged into one newest-first
 * timeline. An event that belongs to a listed battle is shown once, as the
 * battle. Deltas compare each solve with the solve before it.
 */
export function BattleTimeline({
  battles,
  timeline,
}: {
  battles: Battle[];
  timeline: ProblemEvent[];
}) {
  const battleIds = new Set(battles.map((b) => b.id));
  const entries: Entry[] = [
    ...battles.map((b): Entry => {
      const kind: ProblemEventKind | null =
        b.outcome === "solved" ? "solved" : b.outcome === "failed" ? "failed" : null;
      return {
        id: b.id,
        label: kind ? KIND_LABEL[kind].label : b.outcome === "in_progress" ? "In progress" : "Abandoned",
        tone: kind ? KIND_LABEL[kind].tone : "neutral",
        at: b.ended_at ?? b.started_at,
        durationSec: b.duration_sec,
        leetcode: b.evidence === "leetcode",
        solve: b.outcome === "solved",
        note: b.outcome === "failed" ? b.scratchpad_md?.trim() || null : null,
      };
    }),
    ...timeline
      .filter((ev) => !(ev.battle_id && battleIds.has(ev.battle_id)))
      .map((ev): Entry => {
        const k = KIND_LABEL[ev.kind];
        const source = (ev.metadata as { source?: string })?.source;
        return {
          id: ev.id,
          label: k.label,
          tone: k.tone,
          at: ev.created_at,
          durationSec: ev.duration_sec,
          leetcode: EVIDENCE_KINDS.has(ev.kind) ? source === "leetcode" : null,
          solve: ev.kind === "solved" || ev.kind === "revisited" || ev.kind === "challenge_completed",
          note: null,
        };
      }),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Each timed solve against the timed solve immediately before it.
  const beat = new Map<string, number>();
  const timed = entries.filter((e) => e.solve && e.durationSec != null);
  for (let i = 0; i < timed.length - 1; i++) {
    const cur = timed[i].durationSec as number;
    const prev = timed[i + 1].durationSec as number;
    if (cur < prev) beat.set(timed[i].id, prev - cur);
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-4 md:p-5">
        <p className="text-sm leading-6 text-text-secondary">
          No battles recorded yet. Your attempts, solves and revisits form a timeline here.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-2.5 md:gap-3">
      {entries.map((e, i) => {
        const time = formatDuration(e.durationSec);
        const delta = beat.get(e.id);
        const [noteHead, ...noteRest] = (e.note ?? "").split("\n").filter((l) => l.trim());
        return (
          <li
            key={e.id}
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-hairline p-3 transition-colors hover:border-hairline-strong md:p-4",
              i === 0 ? "bg-surface-raised md:bg-surface" : "bg-surface"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-2.5">
                <span
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold leading-4",
                    TONE_CLS[e.tone]
                  )}
                >
                  {e.tone === "verified" && <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                  {e.tone === "error" && <CircleX className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                  {e.label}
                </span>
                {time && (
                  <span
                    className={cn(
                      "font-mono text-[15px] leading-6 tnum",
                      e.tone === "error"
                        ? "font-medium text-error md:font-normal md:text-text-secondary"
                        : "font-semibold text-text-primary"
                    )}
                  >
                    {time}
                  </span>
                )}
                <span className="text-hairline-strong" aria-hidden>
                  ·
                </span>
                <time dateTime={e.at} className="text-xs font-medium leading-4 text-text-tertiary">
                  {fmtWhen(e.at)}
                </time>
              </div>
              <div className="flex items-center gap-2">
                {delta != null && (
                  <span className="font-mono text-xs font-medium tracking-[0.06em] text-verified tnum">
                    Beat previous by {fmtDelta(delta)}
                  </span>
                )}
                {e.leetcode === false && (
                  <span className="inline-flex h-6 items-center rounded-xs border border-hairline bg-well px-2 text-[11px] font-medium leading-4 text-text-tertiary">
                    Self-reported
                  </span>
                )}
              </div>
            </div>

            {e.leetcode && (
              <div className="flex items-center gap-2 border-t border-hairline pt-2 text-xs font-medium leading-4 text-text-secondary">
                <ArrowLeftRight className="h-[15px] w-[15px] text-text-tertiary" strokeWidth={1.5} aria-hidden />
                Accepted LeetCode sync
              </div>
            )}

            {noteHead && (
              <div className="mt-1 flex items-start gap-2 rounded-md border border-hairline bg-well p-3">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-medium leading-5 text-text-primary">{noteHead}</p>
                  {noteRest.length > 0 && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-text-tertiary">
                      {noteRest.join(" ")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
