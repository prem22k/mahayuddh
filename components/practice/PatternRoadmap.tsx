"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookMarked, Check, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoadmapEntry, RoadmapGroups } from "@/lib/primerMastery";

/**
 * The patterns roadmap in the Practice rail. Collapsed, it shows the next few
 * to learn; expanded, every pattern grouped Up next / Read / Mastered, so the
 * ones you haven't read sit on top and the ones you've finished sink to the
 * bottom but stay there for revision.
 */
export function PatternRoadmap({ groups, preview = 4 }: { groups: RoadmapGroups; preview?: number }) {
  const [open, setOpen] = useState(false);
  const total = groups.upNext.length + groups.read.length + groups.mastered.length;
  const written = (e: RoadmapEntry) => e.written;
  // Collapsed: what to read next, then what you're working through.
  const next = [...groups.upNext.filter(written), ...groups.read].slice(0, preview);

  return (
    <div className="space-y-3">
      {open ? (
        <div className="space-y-5">
          <Group title="Up next" entries={groups.upNext} />
          <Group title="Read" entries={groups.read} />
          <Group title="Mastered" entries={groups.mastered} />
        </div>
      ) : (
        <div className="space-y-2">
          {next.map((e) => (
            <Row key={e.slug} entry={e} />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
      >
        {open ? "Show less" : `See all ${total} patterns`}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

function Group({ title, entries }: { title: string; entries: RoadmapEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="space-y-2" aria-label={title}>
      <h3 className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary tnum">
        {title} · {entries.length}
      </h3>
      <div className="space-y-2">
        {entries.map((e) => (
          <Row key={e.slug} entry={e} />
        ))}
      </div>
    </section>
  );
}

function Row({ entry: e }: { entry: RoadmapEntry }) {
  const status = e.mastered && e.revise === "failure"
    ? { label: "Needs revision", tone: "text-error" }
    : e.mastered && e.revise === "stale"
      ? { label: "Revise", tone: "text-primary" }
      : e.mastered
        ? { label: "Mastered", tone: "text-verified" }
        : null;
  const sub = !e.written
    ? "Primer coming"
    : e.progress
      ? `${e.progress.solved} of ${e.progress.total} solved${e.read ? "" : " · not read yet"}`
      : e.read
        ? "Read"
        : e.blurb;

  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2.5">
        {e.mastered && !e.revise ? (
          <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-verified" strokeWidth={1.75} aria-hidden />
        ) : e.revise ? (
          <RotateCcw className="mt-0.5 h-[18px] w-[18px] shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
        ) : (
          <BookMarked
            className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", e.written ? "text-pattern" : "text-text-disabled")}
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        <span className="min-w-0">
          <span className={cn("block truncate text-sm font-medium leading-5", e.written ? "text-text-primary" : "text-text-tertiary")}>
            {e.pattern}
          </span>
          <span className="mt-0.5 block truncate text-xs leading-4 text-text-tertiary tnum">{sub}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {status && <span className={cn("text-xs font-medium", status.tone)}>{status.label}</span>}
        {e.written && (
          <ChevronRight
            className="h-[18px] w-[18px] text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
      </span>
    </>
  );

  const cls = "group flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-hairline p-3 md:rounded-md";
  return e.written ? (
    <Link href={`/primers/${e.slug}`} className={cn(cls, "bg-surface transition-colors hover:bg-surface-raised")}>
      {body}
    </Link>
  ) : (
    <div className={cn(cls, "border-dashed bg-transparent")} aria-label={`${e.pattern}: primer coming`}>
      {body}
    </div>
  );
}
