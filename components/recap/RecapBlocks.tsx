import React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  CheckCheck,
  CodeXml,
  Copy,
  LifeBuoy,
  Swords,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Pass, PassField } from "@/components/pass/Pass";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { formatDuration, titleFromSlug } from "@/lib/format";
import type { RecapBody, RecapEntry } from "@/lib/recap";
import { formatSpeedup } from "./recapFormat";

/**
 * Presentational blocks shared by the weekly recap and the season summary.
 *
 * Every block renders values the artifact already holds. A block whose data
 * is absent is left out by the page, never filled with a stand-in.
 */

/** Mono uppercase section caption with an optional right-hand slot. */
export function SectionLabel({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
        {children}
      </h2>
      {right}
    </div>
  );
}

/** Struck-through old time, arrow, new time. Both values come straight from the artifact. */
export function TimeDelta({
  fromSec,
  toSec,
  size = "lg",
}: {
  fromSec: number;
  toSec: number;
  size?: "lg" | "md";
}) {
  const from = formatDuration(fromSec);
  const to = formatDuration(toSec);
  const lg = size === "lg";
  return (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1" aria-label={`From ${from} to ${to}`}>
      <span
        className={cn(
          "font-mono text-text-tertiary line-through tnum",
          lg ? "text-xl md:text-2xl" : "text-sm"
        )}
      >
        {from}
      </span>
      <ArrowRight
        className={cn("shrink-0 self-center text-text-tertiary", lg ? "h-4 w-4" : "h-3.5 w-3.5")}
        strokeWidth={1.5}
        aria-hidden
      />
      <span
        className={cn(
          "font-mono font-medium text-text-primary tnum",
          lg ? "text-[40px] leading-none tracking-[-0.02em] md:text-5xl" : "text-xl leading-7"
        )}
      >
        {to}
      </span>
    </p>
  );
}

/** "8m 34s faster". Neutral: the artifact doesn't record whether either solve was verified. */
export function SpeedupChip({
  fromSec,
  toSec,
  className,
}: {
  fromSec: number;
  toSec: number;
  className?: string;
}) {
  const text = formatSpeedup(fromSec, toSec);
  if (!text) return null;
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-xs border border-hairline-strong bg-surface-raised px-2.5 font-mono text-xs font-medium text-text-primary tnum",
        className
      )}
    >
      <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      {text}
    </span>
  );
}

/**
 * The week's (or season's) biggest improvement as a Pass: who and which
 * problem on the body, the stored old and new times, and a stub of the
 * artifact's own identifiers.
 */
export function ImprovementPass({
  username,
  slug,
  fromSec,
  toSec,
  fields,
}: {
  username: string | null;
  slug: string;
  fromSec: number;
  toSec: number;
  fields: { label: string; value: React.ReactNode }[];
}) {
  return (
    <Pass
      stubClassName="justify-start gap-3 max-md:flex-row max-md:flex-wrap max-md:gap-x-6 max-md:py-4"
      body={
        <div className="space-y-6">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={username ?? "?"}
              size="md"
              className="h-10 w-10 border border-hairline font-mono"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-text-primary">
                {username ? `@${username}` : "A squad member"}
              </p>
              <p className="mt-0.5 truncate text-sm text-text-secondary">{titleFromSlug(slug)}</p>
            </div>
          </div>
          <div className="space-y-3">
            <TimeDelta fromSec={fromSec} toSec={toSec} />
            <SpeedupChip fromSec={fromSec} toSec={toSec} />
          </div>
        </div>
      }
      stub={fields.map((f) => (
        <PassField key={f.label} label={f.label}>
          {f.value}
        </PassField>
      ))}
    />
  );
}

/** The week in numbers: one card of five on desktop, tiles on a phone. */
export function RecapNumbers({ body }: { body: RecapBody }) {
  const cells: { label: string; value: number; note?: string | null; icon: LucideIcon }[] = [
    { label: "Solves", value: body.solves, icon: CodeXml },
    { label: "Challenges sent", value: body.challengesSent, icon: Swords },
    {
      label: "Beaten",
      value: body.challengesCompleted,
      // A ratio of two stored counts, shown only when there is a denominator.
      note:
        body.challengesSent > 0
          ? `${Math.round((body.challengesCompleted / body.challengesSent) * 100)}% of sent`
          : null,
      icon: CheckCheck,
    },
    { label: "Approaches", value: body.approachesWritten, icon: BookOpen },
    {
      label: "Stuck asks",
      value: body.stuckRequests,
      note: body.stuckRequests > 0 ? `${body.stuckHelped} answered` : null,
      icon: LifeBuoy,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-0 sm:divide-x sm:divide-hairline sm:rounded-xl sm:border sm:border-hairline sm:bg-surface sm:py-5">
      {cells.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={cn(
              "flex flex-col rounded-lg border border-hairline bg-surface p-3.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-4 sm:py-1",
              i === 0 && "col-span-2 sm:col-span-1"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em] text-text-primary tnum lg:text-4xl">
                {c.value}
              </span>
              <Icon className="h-[18px] w-[18px] text-text-tertiary sm:hidden" strokeWidth={1.5} aria-hidden />
            </div>
            <span className="mt-1.5 text-xs font-medium text-text-secondary">{c.label}</span>
            {c.note && (
              <span className="mt-0.5 font-mono text-[11px] text-text-tertiary tnum">{c.note}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function entryIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes("improv")) return Timer;
  if (l.includes("challeng")) return Swords;
  if (l.includes("cop")) return Copy;
  if (l.includes("knowledge") || l.includes("approach")) return BookOpen;
  if (l.includes("stuck")) return LifeBuoy;
  if (l.includes("common")) return Users;
  if (l.includes("solve")) return CodeXml;
  return Activity;
}

/** "What happened": the recap's own prose lines, label underneath in mono. */
export function HappenedList({ entries }: { entries: RecapEntry[] }) {
  return (
    <ul className="space-y-2 md:space-y-0 md:divide-y md:divide-hairline md:overflow-hidden md:rounded-xl md:border md:border-hairline md:bg-surface">
      {entries.map((e, i) => {
        const Icon = entryIcon(e.label);
        return (
          <li
            key={`${e.label}-${i}`}
            className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-3.5 md:gap-3.5 md:rounded-none md:border-0 md:bg-transparent md:p-5"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-overlay text-text-secondary">
              <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium leading-snug text-text-primary">{e.detail}</p>
              <p className="font-mono text-xs text-text-tertiary">{e.label}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** "What didn't happen": explicitly-empty sections, stated rather than hidden. */
export function DidNotHappenList({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-3 rounded-xl border border-hairline bg-well p-4 md:p-5">
      {lines.map((line, i) => (
        <li key={`${line}-${i}`} className="flex items-start gap-3 text-sm leading-6">
          <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
          <span className="font-medium text-text-primary">{line}</span>
        </li>
      ))}
    </ul>
  );
}
