"use client";

import React from "react";
import { Flame, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pass, PassField } from "@/components/pass/Pass";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { SquadStreak } from "@/lib/data/squadActivity";

export interface StreakPassMember {
  id: string;
  /** First word of the username: what the grid and the "to go" line show. */
  name: string;
  full: string;
  avatarUrl: string | null;
  mine: boolean;
}

function formatSince(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}`;
}

/**
 * The squad streak Pass (Stitch "Squad" frame).
 *
 * Body: the run, who still owes today, and the last seven squad-local days per
 * member. Stub: the facts that would be printed on a ticket. Everything here is
 * read from the same week grid and streak walk the page already loads; nothing
 * is filled in when it is missing.
 */
export function SquadStreakPass({
  squadName,
  streakLabel,
  members,
  weekDays,
  weekGrid,
  streak,
  activityError,
  onSolve,
}: {
  squadName: string;
  /**
   * Caption over the numeral. Comes from the page so the hub keeps the shared
   * streak and the members' LeetCode streaks labeled apart (product rule).
   */
  streakLabel: string;
  members: StreakPassMember[];
  /** Oldest -> newest; the last entry is today. */
  weekDays: { key: string; label: string }[];
  weekGrid: Record<string, boolean[]>;
  streak: SquadStreak | null;
  activityError: string | null;
  onSolve: () => void;
}) {
  const todayIdx = weekDays.length - 1;
  const solvedToday = (id: string) => weekGrid[id]?.[todayIdx] ?? false;
  const solvedCount = members.filter((m) => solvedToday(m.id)).length;
  const unsolved = members.filter((m) => !solvedToday(m.id)).map((m) => (m.mine ? "you" : m.name));
  const everyoneSolved = members.length > 0 && unsolved.length === 0;
  const runDays = streak?.days ?? 0;
  const running = runDays > 0;

  const numeral = streak
    ? `${streak.days} ${streak.days === 1 ? "day" : "days"}`
    : activityError
      ? "—"
      : "…";

  const count = (
    <strong className="font-medium text-text-primary">
      {solvedCount} of {members.length}
    </strong>
  );
  const shown = unsolved.slice(0, 2);
  const more = unsolved.length - shown.length;
  const line = activityError ? (
    "Couldn't load today's solves"
  ) : streak == null ? (
    "Loading streak…"
  ) : members.length === 0 ? (
    "No members yet"
  ) : everyoneSolved ? (
    <>{count} solved today · everyone solved</>
  ) : (
    <>
      {count} solved today ·{" "}
      {shown.map((n, i) => (
        <React.Fragment key={`${n}-${i}`}>
          {i > 0 && (more > 0 ? ", " : " and ")}
          <span className="font-medium text-primary">{n}</span>
        </React.Fragment>
      ))}
      {more > 0 && ` and ${more} more`} to go
    </>
  );

  // What today's solve does to the run, from the same walk the numeral uses.
  const lockLine =
    streak && members.length > 0
      ? everyoneSolved
        ? `Day ${streak.days} locked in for ${squadName}`
        : `Locks in day ${streak.days + 1} for ${squadName}`
      : null;

  return (
    <Pass
      stubClassName="justify-between gap-4"
      body={
        <div className="flex flex-col gap-5 md:gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary-tint text-primary md:h-12 md:w-12">
              {/* Outlined until everyone has solved today. */}
              <Flame
                className="h-6 w-6 md:h-7 md:w-7"
                strokeWidth={2}
                fill={everyoneSolved ? "currentColor" : "none"}
              />
            </div>
            <div className="min-w-0">
              <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary md:text-[11px]">
                {streakLabel}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-[30px] font-semibold leading-none tracking-tight text-text-primary tnum md:text-5xl">
                  {numeral}
                </span>
                {running && (
                  <span className="rounded-xs border border-primary/20 bg-primary-tint/60 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary md:px-2 md:text-xs">
                    <span className="md:hidden">Active</span>
                    <span className="hidden md:inline">Active run</span>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-text-secondary md:text-sm">{line}</p>
            </div>
          </div>

          {/* Seven squad-local days per member. */}
          <div className="rounded-lg border border-hairline bg-well p-3 md:p-4">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-hairline pb-2 font-mono text-[11px] text-text-tertiary md:mb-3 md:pb-3 md:text-xs">
              <span className="md:uppercase md:tracking-wider">
                <span className="md:hidden">Member</span>
                <span className="hidden md:inline">Squad member</span>
              </span>
              <div className="grid w-[170px] shrink-0 grid-cols-7 gap-2 text-center md:w-[210px] md:gap-3">
                {weekDays.map((d, i) =>
                  i === todayIdx ? (
                    <span key={d.key} className="font-medium text-primary">
                      <span className="md:hidden">Now</span>
                      <span className="hidden md:inline">Today</span>
                    </span>
                  ) : (
                    <span key={d.key}>
                      <span className="md:hidden">{d.label.charAt(0)}</span>
                      <span className="hidden md:inline">{d.label}</span>
                    </span>
                  )
                )}
              </div>
            </div>

            {members.length > 0 ? (
              <div className="flex flex-col gap-2 md:gap-2.5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center justify-between gap-2 text-xs",
                      m.mine && "-mx-1 rounded-xs bg-surface-raised/40 px-1 py-0.5 md:-mx-1.5 md:rounded-sm md:px-1.5 md:py-1"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={m.full}
                        src={m.avatarUrl}
                        size="sm"
                        className={cn(
                          "hidden text-[11px] text-text-primary md:inline-flex",
                          m.mine && "bg-primary/20 font-semibold text-primary"
                        )}
                      />
                      <span className="truncate font-medium text-text-primary">
                        {m.name}
                        {m.mine && <span className="font-normal text-text-tertiary"> (you)</span>}
                      </span>
                    </div>
                    <div className="grid w-[170px] shrink-0 grid-cols-7 items-center justify-items-center gap-2 md:w-[210px] md:gap-3">
                      {weekDays.map((d, di) => {
                        const filled = weekGrid[m.id]?.[di] ?? false;
                        const isToday = di === todayIdx;
                        return (
                          <span
                            key={d.key}
                            title={`${m.full} · ${isToday ? "Today" : d.label} · ${filled ? "solved" : "not yet"}`}
                            className={cn(
                              "h-2 w-2 rounded-full md:h-2.5 md:w-2.5",
                              filled
                                ? cn("bg-verified", isToday && "ring-1 ring-verified/30 md:ring-2 md:ring-verified/20")
                                : isToday
                                  ? cn("border-2 bg-transparent", m.mine ? "border-primary" : "border-text-tertiary")
                                  : "border border-hairline-strong"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-text-secondary">No members yet.</p>
            )}

            <div className="mt-3 hidden items-center justify-between border-t border-hairline pt-2 font-mono text-[11px] text-text-tertiary md:flex">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-verified" aria-hidden /> Solved
                <span className="ml-2 h-2 w-2 rounded-full border border-primary" aria-hidden /> Needed today
              </span>
              <span>Hover a dot for the day</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center">
            <Button
              variant="primary"
              size="lg"
              className="h-11 w-full shrink-0 gap-2.5 whitespace-nowrap md:h-12 md:w-auto"
              onClick={onSolve}
            >
              <Play className="h-4 w-4" strokeWidth={2} />
              Solve today&apos;s battle
            </Button>
            {lockLine && (
              <span className="hidden font-mono text-xs text-text-tertiary md:inline">{lockLine}</span>
            )}
          </div>
        </div>
      }
      stub={
        <>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="uppercase tracking-widest text-text-tertiary">Pass stub</span>
              {running && <span className="text-primary tnum">#STRK-{runDays}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:py-2">
              <PassField label="Squad">{squadName}</PassField>
              <PassField label="Run started">
                {running && streak ? `Since ${formatSince(streak.since)}` : streak ? "No run yet" : "—"}
              </PassField>
              <PassField label="Roster">
                {members.length} {members.length === 1 ? "member" : "members"}
              </PassField>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-3 md:pt-4" aria-hidden>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-hairline-strong font-mono text-[10px] text-text-tertiary">
                M
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
                Mahayuddh seal
              </span>
            </div>
            <span className="flex items-center gap-0.5 opacity-40">
              {[0.5, 1, 0.5, 1.5, 0.5, 1].map((w, i) => (
                <span key={i} className="h-4 bg-text-primary" style={{ width: `${w * 4}px` }} />
              ))}
            </span>
          </div>
        </>
      }
    />
  );
}
