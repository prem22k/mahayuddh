"use client";

import React from "react";
import Link from "next/link";
import { Link2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { OverflowMenu, type OverflowItem } from "@/components/practice/OverflowMenu";
import type { Suggestion } from "@/types/database";
import { ChainTrack, ChallengeStatusChip } from "./ChainTrack";
import type { ProblemMeta } from "./ChallengePass";
import { challengeStatus, dueParts, fmtClock, handleOf, shortDate } from "./challengeFormat";

/** The one visible row action; everything else lives in the ⋯ menu. */
export interface RowAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

/**
 * Stitch challenge row. Desktop: one 64px line (who · problem + target line ·
 * status + action). Phone: a stacked card with the due line and action in a
 * footer. The title is a stretched link to the challenge's own pass.
 */
export function ChallengeRow({
  item,
  viewerId,
  meta,
  lineage,
  action,
  menu,
}: {
  item: Suggestion;
  viewerId?: string | null;
  meta?: ProblemMeta | null;
  /** Oldest-first chain ending at this row; a track renders when it has 2+ hops. */
  lineage: Suggestion[];
  action: RowAction;
  menu: OverflowItem[];
}) {
  const isTarget = item.to_user === viewerId;
  const status = challengeStatus(item);
  const dim = status.key === "expired" || status.key === "declined";
  const fromName = item.from_user === viewerId ? "You" : handleOf(item.from_profile, "Member");
  const toName = isTarget ? "You" : handleOf(item.to_profile, "Member");
  const isChain = lineage.length >= 2;
  const time = fmtClock(item.sender_time_sec);
  const due = dueParts(item.deadline_at);
  const note = (item.message ?? item.note ?? "").trim();
  // Same spoiler rule as before: hidden from everyone but the recipient until done.
  const noteHidden = item.spoiler && !isTarget && item.status !== "completed";

  const target = time ? (item.beat_time ? `Target: Beat ${time}` : `Solved in ${time}`) : "No time to beat";
  const when =
    status.key === "solved"
      ? shortDate(item.completed_at)
        ? `Solved ${shortDate(item.completed_at)}`
        : "Solved"
      : status.key === "expired"
        ? `Expired ${due?.rel ?? ""}`.trim()
        : status.key === "declined"
          ? "Declined"
          : due
            ? `due ${due.rel}`
            : "No deadline";
  const sub = isChain ? `${lineage.length}-hop chain` : `Direct · ${shortDate(item.created_at) ?? ""}`.replace(/ · $/, "");

  return (
    <article
      className={cn(
        "group relative rounded-lg border border-hairline p-3.5 transition-colors hover:border-hairline-strong md:px-5 md:py-3 md:hover:bg-surface-raised",
        // An open ⋯ menu must sit above the next row's buttons.
        "has-[[aria-expanded=true]]:z-20",
        dim ? "bg-surface/60 opacity-80" : "bg-surface"
      )}
    >
      <div className="md:flex md:min-h-10 md:items-center md:gap-5">
        {/* Who */}
        <div className="flex items-center justify-between gap-2 md:block md:w-48 md:shrink-0">
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1 font-mono text-xs font-medium leading-4 text-text-secondary md:font-sans md:text-[13px] md:leading-5 md:text-text-primary">
              {isChain && <Link2 className="hidden h-3.5 w-3.5 shrink-0 text-pattern md:block" strokeWidth={1.5} aria-hidden />}
              <span className="truncate">{fromName}</span>
              <span aria-hidden className="shrink-0 text-text-tertiary">→</span>
              <span className="sr-only">to</span>
              <span className="truncate">{toName}</span>
            </p>
            <p className="hidden truncate font-mono text-[11px] font-medium leading-4 tracking-[0.04em] text-text-tertiary md:block">
              {sub}
            </p>
          </div>
          <ChallengeStatusChip item={item} className="md:hidden" />
        </div>

        {/* Problem + target line */}
        <div className="mt-2 min-w-0 md:mt-0 md:flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:flex-nowrap">
            <Link
              href={`/c/${item.id}`}
              className={cn(
                "min-w-0 text-sm font-semibold leading-5 after:absolute after:inset-0 after:rounded-lg hover:underline hover:decoration-hairline-strong hover:underline-offset-[3px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-text-primary/70 md:truncate",
                dim ? "text-text-secondary" : "text-text-primary"
              )}
            >
              {item.problem_title}
            </Link>
            <DifficultyBadgeNew difficulty={item.difficulty} size="sm" />
            {meta?.pattern && <PatternChip label={meta.pattern} className="h-5 shrink-0 px-2 text-[11px]" />}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-xs leading-4 text-text-secondary tnum md:mt-0.5">
            {meta?.number && <span className="text-text-tertiary">No. {meta.number}</span>}
            {meta?.number && <span aria-hidden className="text-text-tertiary">·</span>}
            <span>{target}</span>
            <span aria-hidden className="hidden text-text-tertiary md:inline">·</span>
            <span className="hidden text-text-tertiary md:inline">{when}</span>
          </p>
          {note && !noteHidden && (
            <p className="mt-1.5 line-clamp-2 text-[13px] italic leading-5 text-text-tertiary md:line-clamp-1">
              &ldquo;{note}&rdquo;
            </p>
          )}
          {note && noteHidden && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-5 text-text-tertiary">
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
              Hidden hint, reveals when accepted.
            </p>
          )}
        </div>

        {/* Status + actions (phone: footer row) */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-2.5 md:mt-0 md:shrink-0 md:justify-end md:gap-3 md:border-0 md:pt-0">
          <span className="font-mono text-xs font-medium leading-4 tracking-[0.04em] text-text-tertiary md:hidden">
            {isChain ? `${sub} · ${when}` : when}
          </span>
          <div className="relative z-10 flex items-center gap-2">
            <ChallengeStatusChip item={item} className="hidden md:inline-flex" />
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
              className="inline-flex h-11 items-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-3 text-xs font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled md:h-8"
            >
              {action.icon}
              {action.label}
            </button>
            <OverflowMenu items={menu} label="More challenge actions" className="md:h-8 md:w-8" />
          </div>
        </div>
      </div>

      {isChain && <ChainTrack chain={lineage} viewerId={viewerId} className="relative z-10 mt-3" />}
    </article>
  );
}
