"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PatternChip, SelfReportedBadge, VerifiedBadge } from "@/components/ui/Badge";
import { formatDuration, titleFromSlug } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedEvent } from "@/types/database";

/**
 * Arena "From your squad" (Stitch): the last few squad feed rows. Desktop is a
 * stack of 56px rows; phone groups them into one card with dividers.
 */

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function meta(e: FeedEvent) {
  const m = e.metadata ?? {};
  const dur = typeof m.duration_sec === "number" && Number.isFinite(m.duration_sec) ? m.duration_sec : null;
  const pattern = typeof m.pattern === "string" && m.pattern.length > 0 ? m.pattern : null;
  const v = m.verified ?? m.evidence;
  const verified =
    v === true || v === "leetcode" || v === "verified"
      ? true
      : v === false || v === "self" || v === "self-reported"
        ? false
        : null;
  const slug =
    e.problem_slug ?? (typeof m.problem_slug === "string" ? (m.problem_slug as string) : null);
  const problem = e.problem_title || (slug ? titleFromSlug(slug) : null);
  return { dur, pattern, verified, problem };
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-text-primary">{children}</span>;
}

/** The action phrase after the actor's name. Only what the row records. */
function describe(e: FeedEvent): React.ReactNode {
  const { dur, problem } = meta(e);
  const t = formatDuration(dur);
  const p = problem ? <Strong>{problem}</Strong> : "a problem";
  switch (e.event_type) {
    case "solve":
    case "solved":
      return (
        <>
          solved {p}
          {t && (
            <>
              {" in "}
              <span className="font-mono text-text-primary tnum">{t}</span>
            </>
          )}
        </>
      );
    case "teach":
      return <>explained an approach to {problem ? p : "a problem"}</>;
    case "challenge":
      return <>sent a challenge{problem ? <>: {p}</> : null}</>;
    case "complete":
    case "completed":
      return <>completed a challenge{problem ? <>: {p}</> : null}</>;
    case "resource":
      return <>shared a resource{problem ? <>: {p}</> : null}</>;
    case "discuss":
      return <>started a discussion on {p}</>;
    case "stuck":
      return <>is stuck{problem ? <> on {p}</> : null}</>;
    case "improve":
      return <>improved {p}</>;
    default:
      return e.event_type.replace(/_/g, " ");
  }
}

function Chip({ e }: { e: FeedEvent }) {
  const { verified, pattern } = meta(e);
  const isSolve = e.event_type === "solve" || e.event_type === "solved";
  if (isSolve && verified === true) return <VerifiedBadge className="h-5 px-1.5" />;
  if (isSolve && verified === false) return <SelfReportedBadge className="h-5 px-1.5" />;
  if (pattern) return <PatternChip label={pattern} className="h-5 px-2 text-[11px]" />;
  return null;
}

export function SquadFeed({ events, className }: { events: FeedEvent[]; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5 md:gap-3", className)} aria-label="From your squad">
      <div className="flex items-center justify-between px-0.5 md:px-0">
        <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-text-primary md:text-lg md:leading-[26px]">
          From your squad
        </h2>
        <Link
          href="/feed"
          className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary md:text-sm"
        >
          See all in Feed
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      {events.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface max-md:divide-y max-md:divide-hairline md:gap-2 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
          {events.map((e) => {
            const actor = e.actor ?? e.actor_profile;
            const name = actor?.username ?? "Someone";
            const chip = <Chip e={e} />;
            const when = e.created_at ? timeAgo(e.created_at) : "";
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 p-3.5 md:min-h-14 md:items-center md:rounded-md md:border md:border-hairline md:bg-surface md:px-4 md:py-2.5"
              >
                <Avatar name={name} src={actor?.avatar_url} className="max-md:mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-text-secondary md:text-sm md:leading-6">
                    <span className="font-medium text-text-primary">{name}</span> {describe(e)}
                    <span className="ml-2 hidden align-middle md:inline-flex">{chip}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
                    {chip}
                    {when && (
                      <span className="font-mono text-[11px] text-text-tertiary tnum">{when}</span>
                    )}
                  </div>
                </div>
                {when && (
                  <span className="hidden shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum md:block">
                    {when}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-hairline bg-surface p-4 md:p-6">
          <p className="text-sm font-medium leading-5 text-text-primary">Nothing here yet</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            When your squad solves or explains, it shows up here.
          </p>
        </div>
      )}
    </section>
  );
}
