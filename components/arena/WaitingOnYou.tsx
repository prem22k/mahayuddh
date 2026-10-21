"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck, CircleDashed } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/utils";

/**
 * "Waiting on you" rail cards (Stitch Arena). Each card is one open loop; the
 * page decides which loops are open and passes only data it already has.
 */

const CARD =
  "rounded-lg border border-hairline bg-surface p-3.5 md:p-4";
const LINK_CARD = cn(CARD, "card-interactive group flex min-h-[44px] items-center justify-between gap-3");
const TITLE =
  "block min-w-0 truncate text-sm font-medium leading-5 text-text-primary transition-colors group-hover:text-primary";
const SUB = "block truncate text-xs leading-4 text-text-secondary";

function Chevron() {
  return (
    <ChevronRight
      className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

export function RailHeading({ openLoops }: { openLoops: number | null }) {
  return (
    <div className="flex items-center justify-between px-0.5 md:px-0">
      <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-text-primary md:text-lg md:leading-[26px]">
        Waiting on you
      </h2>
      {openLoops != null && (
        <span className="font-mono text-xs text-text-tertiary tnum lg:hidden">
          {openLoops === 0 ? "All clear" : `${openLoops} open ${openLoops === 1 ? "loop" : "loops"}`}
        </span>
      )}
    </div>
  );
}

export function ChallengeLoop({
  challenge,
  loaded,
  waiting,
}: {
  challenge: {
    fromName: string;
    fromAvatar: string | null;
    problemTitle: string;
    difficulty: string;
    beat: string | null;
    due: string | null;
  } | null;
  loaded: boolean;
  /** Total pending challenges addressed to the caller. */
  waiting: number;
}) {
  if (!challenge) {
    if (!loaded) return <Skeleton className="h-[68px] w-full rounded-lg" />;
    return (
      <div className={CARD}>
        <p className="text-sm leading-5 text-text-secondary">No open challenges. Enjoy the calm.</p>
      </div>
    );
  }
  return (
    <Link href="/challenges" className={LINK_CARD}>
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={challenge.fromName} src={challenge.fromAvatar} className="h-9 w-9 border border-hairline" />
        <span className="min-w-0">
          <span className={TITLE}>{challenge.fromName} challenged you</span>
          <span className={SUB}>
            {challenge.problemTitle} · {challenge.difficulty}
            {challenge.beat && (
              <>
                {" · beat "}
                <span className="font-mono text-text-primary tnum">{challenge.beat}</span>
              </>
            )}
            {challenge.due ? ` · due ${challenge.due}` : ""}
            {waiting > 1 ? ` · ${waiting} waiting` : ""}
          </span>
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

export function StreakLoop({
  hasSquad,
  days,
  alive,
  error,
  members,
  callerId,
  callerSolved,
}: {
  hasSquad: boolean;
  /** null while the streak is loading. */
  days: number | null;
  alive: boolean;
  error: boolean;
  /** Every member, with whether they logged a solve today (squad-local day). */
  members: { id: string; name: string; solved: boolean }[];
  callerId: string | null;
  callerSolved: boolean;
}) {
  const solved = members.filter((m) => m.solved).length;
  const missing = members
    .filter((m) => !m.solved)
    .map((m) => (m.id === callerId ? "you" : m.name));
  let sub: React.ReactNode;
  if (error) sub = "Couldn't load today's solves";
  else if (!hasSquad) sub = "Solo practice — no squad streak yet";
  else if (days == null) sub = "Loading streak…";
  else if (members.length === 0) sub = null;
  else if (missing.length === 0) sub = `${solved} of ${members.length} solved today · everyone solved`;
  else if (solved === 0) sub = `0 of ${members.length} solved today · nobody yet`;
  else
    sub = (
      <>
        {solved} of {members.length} solved today ·{" "}
        {/* Names only when the list is short enough to be complete; the
            member pills below always show exactly who. */}
        <span className="text-text-primary">
          {missing.length > 2
            ? `${missing.length} haven't yet`
            : `${missing.join(" and ")} ${missing.length === 1 && missing[0] !== "you" ? "hasn't" : "haven't"}`}
        </span>
      </>
    );

  return (
    <Link href="/squad" className={cn(CARD, "card-interactive group flex min-h-[44px] flex-col gap-2 md:gap-3")}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {hasSquad && days != null ? (
            <StreakChip count={days} alive={alive} />
          ) : hasSquad && !error ? (
            <Skeleton className="h-6 w-11 rounded-full" />
          ) : null}
          <span className="truncate text-sm font-medium leading-5 text-text-primary transition-colors group-hover:text-primary">
            Squad streak{hasSquad && days != null ? ` · ${days} ${days === 1 ? "day" : "days"}` : ""}
          </span>
        </span>
        {hasSquad && days != null && !callerSolved && (
          <span className="shrink-0 font-mono text-xs font-medium text-primary lg:hidden">Solve today</span>
        )}
      </span>
      {sub && <span className="text-xs leading-4 text-text-secondary">{sub}</span>}
      {hasSquad && members.length > 0 && (
        <span
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px] leading-4 md:rounded-md md:border md:border-hairline md:bg-well md:p-2 md:text-xs"
        >
          {members.map((m) => (
            <span
              key={m.id}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5",
                m.id === callerId ? "font-medium text-text-primary" : "text-text-tertiary"
              )}
              title={`${m.name} · ${m.solved ? "solved today" : "not yet"}`}
            >
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  m.solved ? "bg-verified" : "border border-hairline-strong"
                )}
              />
              <span className="truncate">{m.name}</span>
              <span className="sr-only">{m.solved ? ", solved today" : ", not yet"}</span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

export function GoalLoop({
  goal,
}: {
  goal: {
    title: string;
    done: number;
    target: number;
    pct: number;
    daysRemaining: number | null;
    participants: number;
    memberCount: number;
  } | null;
}) {
  if (!goal) {
    return (
      <Link href="/squad" className={cn(CARD, "card-interactive group block min-h-[44px]")}>
        <span className={TITLE}>No active goal</span>
        <span className="mt-1 block text-xs leading-4 text-text-secondary">
          Set one in the Squad hub to give the week a target.
        </span>
      </Link>
    );
  }
  const pct = Math.max(0, Math.min(100, Math.round(goal.pct)));
  return (
    <Link href="/squad" className={cn(CARD, "card-interactive group flex min-h-[44px] flex-col gap-2 md:gap-2.5")}>
      <span className="flex items-center justify-between gap-3">
        <span className={TITLE}>{goal.title}</span>
        <span className="shrink-0 font-mono text-xs font-medium text-pattern tnum">{pct}%</span>
      </span>
      <span
        className="block h-1.5 overflow-hidden rounded-full bg-well md:border md:border-hairline"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${goal.title} progress`}
      >
        <span className="block h-full rounded-full bg-pattern" style={{ width: `${pct}%` }} />
      </span>
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs leading-4 text-text-secondary">
        <span>
          {goal.done} of {goal.target} problems
        </span>
        <span className="text-text-tertiary md:text-text-secondary">
          {goal.daysRemaining != null ? `${goal.daysRemaining} days left · ` : ""}
          {goal.participants}/{goal.memberCount} contributed
        </span>
      </span>
    </Link>
  );
}

const REASON_LABEL: Record<string, string> = {
  failed: "revenge",
  gap: "fading",
  weak_pattern: "weak pattern",
  bookmark: "bookmarked",
  low_confidence: "low confidence",
};

export function ReviewLoop({ reasons }: { reasons: string[] }) {
  const n = reasons.length;
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  const breakdown = Array.from(counts.entries())
    .map(([r, c]) => `${c} ${REASON_LABEL[r] ?? r.replace(/_/g, " ")}`)
    .join(" · ");
  return (
    <Link href="/practice" className={LINK_CARD}>
      <span className="min-w-0">
        <span className={TITLE}>
          {n > 0 ? `${n} ${n === 1 ? "problem" : "problems"} due for review` : "Nothing due for review"}
        </span>
        <span className={cn(SUB, "mt-0.5")}>{n > 0 ? breakdown : "You're caught up"}</span>
      </span>
      <Chevron />
    </Link>
  );
}

/** Quiet LeetCode sync line at the foot of the rail. */
export function SyncRow({ syncedAgo }: { syncedAgo: string | null }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 font-mono text-xs text-text-tertiary md:justify-between md:rounded-lg md:border md:border-hairline md:bg-surface/50 md:px-4 md:py-2.5">
      <span className="flex min-w-0 items-center gap-2">
        {syncedAgo ? (
          <CircleCheck className="h-3.5 w-3.5 shrink-0 text-verified" strokeWidth={1.75} aria-hidden />
        ) : (
          <CircleDashed className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        )}
        <span className="truncate">{syncedAgo ? "Synced with LeetCode" : "Not synced yet"}</span>
      </span>
      {syncedAgo && <span className="shrink-0 tnum">{syncedAgo}</span>}
    </div>
  );
}

/** Plain rail note with one quiet action (solo / connect LeetCode). */
export function RailNote({
  title,
  body,
  action,
}: {
  title?: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className={cn(CARD, "flex flex-col gap-2")}>
      {title && <p className="text-sm font-medium leading-5 text-text-primary">{title}</p>}
      <p className="text-xs leading-5 text-text-secondary">{body}</p>
      <div>{action}</div>
    </div>
  );
}
