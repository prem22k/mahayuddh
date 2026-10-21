"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import { Skeleton } from "@/components/ui/States";
import { getActiveSquadMembers } from "@/lib/data/squads";
import { getSquadProblemStatuses } from "@/lib/data/sheets";
import { daysBetween, formatDuration, relativeDays } from "@/lib/format";
import type { ProblemEvent, TriState } from "@/types/database";

const SOLVE_KINDS = new Set(["solved", "revisited", "challenge_completed"]);

interface MemberRow {
  id: string;
  name: string;
  self: boolean;
  status: TriState;
  bestSec: number | null;
  verified: boolean;
  caption: string | null;
}

/**
 * "Your squad on this problem" (Stitch rail). Real rows only: the active
 * squad's members, their status on this slug, and their best measured time
 * from the public event log. No squad → an honest prompt, never sample people.
 */
export function SquadOnProblem({
  slug,
  userId,
  username,
  avatarUrl,
  selfStatus,
  selfBestSec,
  selfVerified,
  events,
}: {
  slug: string;
  userId: string | null;
  username: string | null;
  avatarUrl?: string | null;
  selfStatus: TriState;
  selfBestSec: number | null;
  selfVerified: boolean;
  /** Every visible event on this slug (any user); filtered to members here. */
  events: ProblemEvent[];
}) {
  const [members, setMembers] = useState<{ id: string; username: string }[] | null>(null);
  const [statuses, setStatuses] = useState<Map<string, { status: TriState; at: string }>>(new Map());
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setError(false);
    (async () => {
      try {
        const others = await getActiveSquadMembers();
        const rows = others.length
          ? await getSquadProblemStatuses([slug]).catch(() => [])
          : [];
        if (cancelled) return;
        setMembers(others);
        setStatuses(
          new Map(
            rows.map((r) => [r.user_id, { status: r.status as TriState, at: r.solved_at }])
          )
        );
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  const rows = useMemo<MemberRow[]>(() => {
    if (!members) return [];
    const others: MemberRow[] = members.map((m) => {
      const mine = events.filter((e) => e.user_id === m.id);
      const solves = mine.filter((e) => SOLVE_KINDS.has(e.kind));
      const timed = solves
        .map((e) => e.duration_sec)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const st = statuses.get(m.id);
      const status: TriState =
        st?.status === "solved" || solves.length > 0
          ? "solved"
          : st?.status === "attempted" || mine.length > 0
            ? "attempted"
            : "unsolved";
      const lastAt = mine.length ? mine[mine.length - 1].created_at : st?.at ?? null;
      const solvedAt =
        st?.status === "solved" ? st.at : solves.length ? solves[solves.length - 1].created_at : null;
      return {
        id: m.id,
        name: m.username,
        self: false,
        status,
        bestSec: timed.length ? Math.min(...timed) : null,
        verified: solves.some((e) => (e.metadata as { source?: string })?.source === "leetcode"),
        caption:
          status === "solved" && solvedAt
            ? `Solved ${relativeDays(daysBetween(solvedAt))}`
            : status === "attempted" && lastAt
              ? `Last tried ${relativeDays(daysBetween(lastAt))}`
              : null,
      };
    });
    // Your own row reads the same sources as everyone else's (status row and
    // event log), topped up with your battles, so it never disagrees with the
    // timeline on the same page.
    const ownEvents = userId ? events.filter((e) => e.user_id === userId) : [];
    const ownSolves = ownEvents.filter((e) => SOLVE_KINDS.has(e.kind));
    const ownTimed = ownSolves
      .map((e) => e.duration_sec)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const selfSolved = selfStatus === "solved" || ownSolves.length > 0;
    const selfBest =
      selfBestSec ?? (ownTimed.length ? Math.min(...ownTimed) : null);
    const self: MemberRow = {
      id: userId ?? "self",
      name: username ?? "You",
      self: true,
      status: selfSolved
        ? "solved"
        : selfStatus === "attempted" || ownEvents.length > 0
          ? "attempted"
          : "unsolved",
      bestSec: selfSolved ? selfBest : null,
      verified:
        selfVerified ||
        ownSolves.some((e) => (e.metadata as { source?: string })?.source === "leetcode"),
      caption: selfSolved ? (selfBest != null ? "Personal best" : "Solved") : null,
    };
    const rank = (r: MemberRow) =>
      r.status === "solved" ? (r.bestSec != null ? 0 : 1) : r.status === "attempted" ? 2 : 3;
    const all = [self, ...others].sort(
      (a, b) => rank(a) - rank(b) || (a.bestSec ?? 0) - (b.bestSec ?? 0)
    );
    // "Fastest" only means something when there are two times to compare.
    const timedCount = all.filter((r) => r.bestSec != null).length;
    if (timedCount >= 2 && all[0].bestSec != null && !all[0].self) {
      all[0] = { ...all[0], caption: "Fastest in squad" };
    }
    return all;
  }, [members, statuses, events, userId, username, selfStatus, selfBestSec, selfVerified]);

  const solved = rows.filter((r) => r.status === "solved").length;
  const pct = rows.length ? Math.round((solved / rows.length) * 100) : 0;
  const solo = members != null && members.length === 0;

  return (
    <section
      aria-labelledby="squad-problem-heading"
      className="flex flex-col gap-3 md:rounded-lg md:border md:border-hairline md:bg-surface md:p-4"
    >
      <div className="flex items-center justify-between gap-3 md:border-b md:border-hairline md:pb-3">
        <div className="min-w-0">
          <h2
            id="squad-problem-heading"
            className="text-base font-semibold leading-6 text-text-primary"
          >
            Your squad on this problem
          </h2>
          {members && !solo && (
            <p className="text-xs font-medium leading-4 text-text-tertiary">
              <span className="font-mono tnum">{solved}</span> of{" "}
              <span className="font-mono tnum">{rows.length}</span> solved
            </p>
          )}
        </div>
        {members && !solo && (
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-raised md:hidden" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-xs font-medium text-text-secondary tnum md:text-verified">
              {pct}%
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-surface md:rounded-none md:border-0 md:bg-transparent">
        {!userId ? (
          <p className="p-3 text-sm leading-6 text-text-secondary md:p-0">
            Log in to see how your squad did on this problem.
          </p>
        ) : error ? (
          <p className="p-3 text-sm leading-6 text-text-secondary md:p-0">
            Couldn&apos;t load your squad. Reload to try again.
          </p>
        ) : !members ? (
          <div className="space-y-2 p-3 md:p-0" aria-hidden>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : solo ? (
          <div className="space-y-2 p-3 md:p-0">
            <p className="text-sm leading-6 text-text-secondary">
              Join a squad to see who else has solved this, and how fast.
            </p>
            <Link
              href="/squad"
              className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0"
            >
              Find a squad
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((r) => (
              <SquadRow key={r.id} row={r} avatarUrl={r.self ? avatarUrl : null} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SquadRow({ row, avatarUrl }: { row: MemberRow; avatarUrl?: string | null }) {
  const time = formatDuration(row.bestSec);
  const notYet = row.status === "unsolved";
  return (
    <li
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 px-3 py-2 md:px-0",
        row.self &&
          "bg-surface-raised/70 md:-mx-4 md:border-l-2 md:border-l-primary md:px-4",
        notYet && "opacity-60"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar
          name={row.name}
          src={avatarUrl}
          size="md"
          className={cn(row.self && "bg-primary text-on-primary md:bg-surface-overlay md:text-text-secondary")}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "truncate text-sm leading-5",
                row.self ? "font-semibold text-text-primary" : "font-medium",
                !row.self && (notYet ? "text-text-disabled" : "text-text-primary")
              )}
            >
              {row.self ? "You" : row.name}
            </span>
            {row.self && row.name !== "You" && (
              <span className="shrink-0 rounded-xs bg-primary-tint px-1.5 font-mono text-[10px] font-medium uppercase leading-4 text-primary">
                {row.name}
              </span>
            )}
          </div>
          {row.caption && (
            <span
              className={cn(
                "block truncate text-[11px] leading-4 md:text-[11px]",
                row.self ? "text-primary md:text-text-secondary" : "text-text-tertiary"
              )}
            >
              {row.caption}
            </span>
          )}
        </div>
      </div>
      {row.status === "solved" ? (
        <div className="flex shrink-0 items-center gap-2">
          {time && (
            <span
              className={cn(
                "font-mono text-sm tnum",
                row.self ? "font-semibold text-primary" : "font-medium text-text-primary"
              )}
            >
              {time}
            </span>
          )}
          <StatusGlyph status={row.verified ? "verified" : "self-reported"} />
        </div>
      ) : row.status === "attempted" ? (
        <span className="shrink-0 rounded-xs border border-hairline bg-well px-2 py-0.5 text-xs font-medium leading-4 text-text-secondary">
          Attempted
        </span>
      ) : (
        <span className="shrink-0 text-xs font-medium leading-4 text-text-disabled">Not yet</span>
      )}
    </li>
  );
}
