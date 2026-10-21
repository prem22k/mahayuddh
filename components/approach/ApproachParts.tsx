import React from "react";
import Link from "next/link";
import { Bug, Clock, Cpu, GitFork, KeyRound, Lightbulb, ListChecks } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip, SelfReportedBadge, VerifiedBadge } from "@/components/ui/Badge";
import { InlineText } from "@/components/notebook/RichText";
import { VisibilityTag } from "@/components/notebook/noteMeta";
import { formatDuration } from "@/lib/format";
import type { SolveProof } from "@/components/approach/solveProof";
import type { ApproachVisibility } from "@/types/database";

/**
 * Presentational zones of the Stitch approach reader, shared by the member
 * page (/approach/[id]) and the public projection (/a/[id]). No hooks, so the
 * server-rendered projection can use them directly.
 */

export function ApproachHeaderCard({
  username,
  avatarUrl,
  visibility,
  createdAt,
  forkCount,
  isOwner = false,
  actions,
  problem,
  pattern,
  proof,
}: {
  username: string;
  avatarUrl?: string | null;
  visibility: ApproachVisibility;
  createdAt: string;
  /** Notebook copies of this approach (trigger-maintained). Hidden at zero. */
  forkCount?: number | null;
  isOwner?: boolean;
  /** Icon actions at the right of the author row (share). */
  actions?: React.ReactNode;
  problem: { number: string | null; title: string; difficulty: string | null; href: string };
  pattern: string | null;
  /** The author's own solve of this problem; null hides the proof box. */
  proof: SolveProof | null;
}) {
  const time = proof ? formatDuration(proof.seconds) : null;
  return (
    <section className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 md:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-edge-highlight" />
      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={username} src={avatarUrl} size="md" className="md:h-10 md:w-10 md:text-sm" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-5 tracking-[-0.01em] text-text-primary md:text-base">
              @{username}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-text-tertiary">
              <VisibilityTag
                visibility={visibility}
                className="h-5 rounded-xs border border-hairline bg-surface-overlay px-1.5 text-text-secondary"
              />
              <span aria-hidden>·</span>
              <span>
                {new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              {forkCount != null && forkCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                    Forked by {forkCount}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOwner && (
            <span className="rounded-xs border border-hairline-strong px-2 py-0.5 font-mono text-[11px] font-medium leading-4 text-text-secondary">
              You own this
            </span>
          )}
          {actions}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-display text-lg font-semibold leading-[26px] tracking-[-0.015em] text-text-primary md:text-[19px]">
            {problem.number && (
              <span className="mr-2 font-mono text-xs font-medium tracking-normal text-text-tertiary tnum md:align-[2px]">
                No. {problem.number}
                <span aria-hidden className="ml-2 hidden md:inline">·</span>
              </span>
            )}
            <Link href={problem.href} className="hover:underline hover:decoration-hairline-strong hover:underline-offset-4">
              {problem.title}
            </Link>
          </h1>
          {(problem.difficulty || pattern) && (
            <div className="flex flex-wrap items-center gap-2">
              {problem.difficulty && <DifficultyBadgeNew difficulty={problem.difficulty} />}
              {pattern && <PatternChip label={pattern} href={`/patterns/${encodeURIComponent(pattern)}`} />}
            </div>
          )}
        </div>
        {proof && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-well px-3 py-2 md:shrink-0 md:justify-start">
            {time && (
              <>
                <div className="flex items-baseline gap-2 md:flex-col md:items-end md:gap-0.5">
                  <span className="text-xs leading-4 text-text-tertiary">Solve time</span>
                  <span className="font-mono text-[17px] font-medium leading-6 text-text-primary tnum">{time}</span>
                </div>
                <span aria-hidden className="hidden h-6 w-px bg-hairline md:block" />
              </>
            )}
            {proof.verified ? <VerifiedBadge /> : <SelfReportedBadge />}
          </div>
        )}
      </div>
    </section>
  );
}

export function CoreIdeaCard({ text }: { text: string }) {
  return (
    <section
      aria-label="Core idea"
      className="relative overflow-hidden rounded-xl border border-hairline bg-well p-4 md:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-hairline-strong to-transparent"
      />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium leading-4 text-text-tertiary">Core idea</h2>
        <Lightbulb className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="whitespace-pre-wrap text-[17px] leading-7 text-text-primary">
        <InlineText text={text} />
      </p>
    </section>
  );
}

type DetailField = {
  key: string;
  label: string;
  icon: typeof Clock;
  value: string | null;
  mono?: boolean;
  tone?: "error";
};

/** Label-left / value-right detail rows; long text stacks below its label on mobile. */
export function ApproachDetails({
  time,
  space,
  keyDetail,
  edgeCases,
  mistakes,
}: {
  time: string | null;
  space: string | null;
  keyDetail: string | null;
  edgeCases: string | null;
  mistakes: string | null;
}) {
  const rows: DetailField[] = (
    [
      { key: "time", label: "Time", icon: Clock, value: time, mono: true },
      { key: "space", label: "Space", icon: Cpu, value: space, mono: true },
      { key: "key", label: "Key detail", icon: KeyRound, value: keyDetail },
      { key: "edge", label: "Edge cases", icon: ListChecks, value: edgeCases },
      { key: "mistakes", label: "Mistakes", icon: Bug, value: mistakes, tone: "error" },
    ] as DetailField[]
  ).filter((r) => r.value && r.value.trim());
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Details"
      className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <div
            key={r.key}
            className={
              r.mono
                ? "flex items-center justify-between gap-4 p-3 transition-colors hover:bg-surface-raised md:p-4"
                : "flex flex-col gap-1.5 p-3 transition-colors hover:bg-surface-raised md:flex-row md:items-start md:justify-between md:gap-6 md:p-4"
            }
          >
            <div className="flex shrink-0 items-center gap-2">
              <Icon
                className={r.tone === "error" ? "h-4 w-4 text-error" : "h-4 w-4 text-text-tertiary"}
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="text-sm font-medium leading-5 text-text-secondary">{r.label}</span>
            </div>
            {r.mono ? (
              <span className="min-w-0 text-right font-mono text-sm leading-5 text-text-primary tnum">{r.value}</span>
            ) : (
              <p className="min-w-0 whitespace-pre-wrap text-[15px] leading-6 text-text-primary md:max-w-[70%] md:text-right md:text-sm md:leading-6">
                <InlineText text={r.value ?? ""} />
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
