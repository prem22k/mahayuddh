"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Trophy } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { primerReadMinutes } from "@/lib/data/primers";
import type { Primer, Suggestion } from "@/types/database";

/** "just now" / "40m ago" / "18h ago" / "3d ago". */
function sinceLabel(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** A near deadline reads as a weekday ("due Fri"); a far one as a date. */
function dueLabel(iso: string): string {
  const d = new Date(iso);
  const days = (d.getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "past due";
  if (days < 6) return `due ${d.toLocaleDateString(undefined, { weekday: "short" })}`;
  return `due ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** Rail section shell: a bare heading on phones, a bordered card on desktop. */
function RailSection({
  id,
  title,
  icon,
  meta,
  children,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 md:gap-3 md:rounded-lg md:border md:border-hairline md:bg-surface md:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-1.5 text-base font-semibold leading-6 text-text-primary">
          {icon}
          {title}
        </h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function OpenChallenges({
  challenges,
  userId,
}: {
  challenges: Suggestion[];
  userId: string | null;
}) {
  if (challenges.length === 0) return null;
  const who = (id: string, name?: string | null) =>
    id === userId ? "You" : name ? `@${name}` : "A squad mate";
  return (
    <RailSection
      id="open-challenges-heading"
      title="Open challenges"
      icon={<Trophy className="hidden h-[18px] w-[18px] text-primary md:block" strokeWidth={1.5} aria-hidden />}
      meta={
        <span className="font-mono text-xs font-medium tracking-[0.06em] text-primary tnum">
          {challenges.length} Active
        </span>
      }
    >
      <div className="space-y-2">
        {challenges.map((c) => {
          const beat = c.beat_time ? formatDuration(c.sender_time_sec) : null;
          return (
            <Link
              key={c.id}
              href={`/c/${c.id}`}
              className="group flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:border-hairline-strong md:rounded-md md:bg-well md:p-3.5"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium leading-5 text-text-primary">
                  {who(c.from_user, c.from_profile?.username)} → {who(c.to_user, c.to_profile?.username)}
                </span>
                <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary-tint px-2 py-0.5 font-mono text-[11px] font-semibold leading-4 text-primary">
                  {c.accepted_at ? "Accepted" : "Open"}
                </span>
              </span>
              <span className="text-xs font-medium leading-4 text-text-secondary">
                {beat ? (
                  <>
                    Target: Beat <span className="font-mono text-text-primary tnum">{beat}</span>
                  </>
                ) : (
                  "Target: Solve it"
                )}
                {c.deadline_at && <> · {dueLabel(c.deadline_at)}</>}
              </span>
              <span className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
                <span className="font-mono text-[11px] leading-4 text-text-tertiary tnum">
                  Sent {sinceLabel(c.created_at)}
                </span>
                <span className="flex items-center gap-0.5 text-xs font-medium leading-4 text-text-secondary transition-colors group-hover:text-text-primary">
                  Open challenge
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </RailSection>
  );
}

export function LearnFirst({ primers }: { primers: Primer[] }) {
  if (primers.length === 0) return null;
  return (
    <RailSection
      id="learn-first-heading"
      title="Learn first"
      meta={<span className="text-xs font-medium leading-4 text-text-tertiary md:hidden">Quick primer</span>}
    >
      {primers.slice(0, 1).map((p) => (
        <Link
          key={p.slug}
          href={`/primers/${p.slug}`}
          className="group flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-raised p-3 transition-colors hover:border-hairline-strong md:rounded-md md:bg-well"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-well text-primary md:h-9 md:w-9 md:border-pattern/30 md:bg-pattern-tint md:text-pattern">
              <BookOpen className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-5 text-text-primary transition-colors md:group-hover:text-pattern">
                {p.title}
              </span>
              {/* Read time is a content-length estimate, never tracked state. */}
              <span className="block text-xs font-medium leading-4 text-text-tertiary">
                About {primerReadMinutes(p)} min read · Primer
              </span>
            </span>
          </span>
          <ChevronRight
            className="h-[18px] w-[18px] shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary"
            strokeWidth={1.5}
            aria-hidden
          />
        </Link>
      ))}
    </RailSection>
  );
}
