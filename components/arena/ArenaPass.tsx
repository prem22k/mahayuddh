"use client";

import React, { useState } from "react";
import { ChevronDown, Ticket } from "lucide-react";
import { PassDots, PassField, PassStubHeader } from "@/components/pass/Pass";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { AvatarStack } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the Arena's Today pass (Stitch "Arena" frames). The page
 * owns every fetch and handler; these only lay out what it already knows.
 */

/** Body padding per the frames: 24px desktop, 20px phone (the shared .pass is 32/24). */
export const ARENA_PASS_CLASS = "[&>.pass-body]:p-6 max-md:[&>.pass-body]:p-5";
export const ARENA_STUB_CLASS = "justify-between p-4";

/** Difficulty · pattern chip · No. — sits above the title. */
export function PassBadges({
  difficulty,
  pattern,
  no,
  leading,
}: {
  difficulty: string;
  pattern: string;
  no: string;
  /** Optional proof badge shown before the difficulty (solved state). */
  leading?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      <DifficultyBadgeNew difficulty={difficulty} className="bg-well" />
      <PatternChip label={pattern} href={`/patterns/${encodeURIComponent(pattern)}`} />
      <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
        No. {no}
      </span>
    </div>
  );
}

export function PassTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-text-primary md:text-[32px] md:leading-[1.1]">
      {children}
    </h2>
  );
}

function sentence(r: string): string {
  const t = r.trim().replace(/[.]+$/, "");
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/**
 * "Why this one · N reasons" disclosure. Desktop: an inline underlined toggle
 * with the reasons summarised underneath. Phone: a quiet well box.
 */
export function WhyThisOne({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = useState(false);
  const n = reasons.length;
  if (n === 0) return null;
  return (
    <div className="max-md:rounded-lg max-md:border max-md:border-hairline max-md:bg-well/60 max-md:px-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex min-h-[44px] w-full items-center justify-between gap-1.5 text-left text-xs font-medium text-text-secondary md:min-h-0 md:w-auto md:justify-start md:text-[15px] md:font-normal md:leading-6"
      >
        <span>
          Why this one ·{" "}
          <span className="text-text-primary underline decoration-hairline-strong underline-offset-4 transition-colors group-hover:text-primary md:font-medium">
            {n} {n === 1 ? "reason" : "reasons"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform duration-150 md:text-text-primary",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {!open && (
        <p className="mt-1 hidden text-[15px] leading-6 text-text-tertiary md:block">
          {reasons.map(sentence).join(", ")}
        </p>
      )}
      {open && (
        <ul className="flex flex-col gap-1.5 pb-3 pt-2 text-xs leading-5 text-text-secondary max-md:border-t max-md:border-hairline md:mt-2 md:rounded-md md:border md:border-hairline md:bg-well md:p-3">
          {reasons.map((r, i) => (
            <li key={r} className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  "mt-2 h-1 w-1 shrink-0 rounded-full",
                  i === 0 ? "bg-text-tertiary" : "bg-pattern"
                )}
              />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface SolvedLineProps {
  hasSquad: boolean;
  /** Avatars: today's solvers when there are any, otherwise the squad. */
  avatars: { name: string; src?: string | null }[];
  solverNames: string[];
  fastest: { time: string; handle: string; verified: boolean } | null;
}

/** Avatar stack + "A, B and C solved it · fastest 14:22 by @a". */
export function SquadSolvedLine({ hasSquad, avatars, solverNames, fastest }: SolvedLineProps) {
  const names = solverNames.slice(0, solverNames.length > 3 ? 2 : 3);
  const extra = solverNames.length - names.length;
  const bold = (n: string) => (
    <span key={n} className="font-medium text-text-primary">
      {n}
    </span>
  );
  let who: React.ReactNode;
  if (!hasSquad) {
    who = "Practicing solo — invite your squad to start the streak";
  } else if (names.length === 0) {
    who = "No one in your squad has solved this yet";
  } else {
    const parts: React.ReactNode[] = [];
    names.forEach((n, i) => {
      if (i > 0) parts.push(i === names.length - 1 && extra === 0 ? " and " : ", ");
      parts.push(bold(n));
    });
    if (extra > 0) parts.push(` and ${extra} more`);
    who = (
      <>
        {parts} solved it
      </>
    );
  }
  return (
    <div className="flex items-center gap-3 md:border-y md:border-hairline md:py-3">
      {avatars.length > 0 && <AvatarStack people={avatars} className="shrink-0 [&>*]:ring-surface" />}
      <p className="text-[13px] leading-5 text-text-secondary md:text-xs md:leading-5">
        {who}
        {fastest && (
          <>
            {" · fastest "}
            <span
              className={cn(
                "font-mono font-medium tnum",
                fastest.verified ? "text-verified" : "text-text-primary"
              )}
            >
              {fastest.time}
            </span>
            {` by ${fastest.handle}`}
          </>
        )}
      </p>
    </div>
  );
}

/** "In progress · 08:14" chip for the running state. */
export function InProgressChip({ clock }: { clock: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-md border border-primary/20 bg-primary-tint px-3 text-primary">
      <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      <span className="text-xs font-medium">In progress ·</span>
      <span className="font-mono text-sm font-semibold tnum">{clock}</span>
    </span>
  );
}

export interface ArenaStubProps {
  serial: string;
  expiry: string;
  /** Real squad name; omitted when solo. */
  faction: string | null;
  /** Today's pick across the squad; null when solo. */
  squad: { solved: number; total: number; people: { name: string; done: boolean }[] } | null;
}

/**
 * Stub contents. Desktop: PASS TICKET header, SERIAL / EXPIRY / FACTION, then
 * SQUAD STATUS with one dot per member. Phone: a 2x2 field grid plus the dots.
 */
export function ArenaStub({ serial, expiry, faction, squad }: ArenaStubProps) {
  const status = squad ? `${squad.solved} OF ${squad.total} SOLVED` : null;
  const pct = squad && squad.total > 0 ? Math.round((squad.solved / squad.total) * 100) : 0;
  const dotsLabel = squad ? `${squad.solved} of ${squad.total} squad members solved today's pick` : "";
  return (
    <>
      {/* Desktop / tablet: vertical stub. */}
      <div className="hidden flex-col gap-4 md:flex">
        <PassStubHeader label="PASS TICKET" icon={<Ticket className="h-4 w-4" strokeWidth={1.5} />} />
        <div className="flex flex-col gap-2.5">
          <PassField label="Serial">No. {serial}</PassField>
          <PassField label="Expiry">{expiry}</PassField>
          {faction && <PassField label="Faction">{faction}</PassField>}
        </div>
      </div>
      {squad && (
        <div className="hidden flex-col gap-2 border-t border-hairline pt-4 md:flex">
          <PassField label="Squad status" className="[&>span:last-child]:text-text-secondary">
            {status}
          </PassField>
          <div role="img" aria-label={dotsLabel}>
            <PassDots people={squad.people} />
          </div>
        </div>
      )}

      {/* Phone: field grid + dots under the perforation. */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-2">
          <PassField label="Serial">No. {serial}</PassField>
          <PassField label="Expiry">{expiry}</PassField>
          {faction && (
            <PassField label="Faction" className="[&>span:last-child]:text-text-secondary">
              {faction}
            </PassField>
          )}
          {status && <PassField label="Squad status">{status}</PassField>}
        </div>
        {squad && (
          <div className="flex shrink-0 flex-col items-end gap-1.5 border-l border-hairline pl-3">
            <div role="img" aria-label={dotsLabel}>
              <PassDots people={squad.people} className="justify-end gap-1" />
            </div>
            <span className="font-mono text-[10px] font-medium uppercase text-text-tertiary tnum">{pct}%</span>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Pass-shaped body for when there is no pick (the problem list failed to load,
 * or there is nothing to pick from). Same footprint as a real pass so the page
 * doesn't jump; never a stand-in problem.
 */
export function PassUnavailable({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[200px] flex-col justify-center gap-4 md:min-h-[260px]" role="status">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.015em] text-text-primary md:text-2xl">
          {title}
        </h2>
        <p className="text-sm leading-6 text-text-secondary">{body}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

/** Stub for the unavailable pass: header and today's date only, no serial. */
export function UnavailableStub({ expiry }: { expiry: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PassStubHeader label="PASS TICKET" icon={<Ticket className="h-4 w-4" strokeWidth={1.5} />} />
      <PassField label="Expiry">{expiry}</PassField>
    </div>
  );
}
