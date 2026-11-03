"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Clock } from "lucide-react";
import { listPrimers, primerReadMinutes } from "@/lib/data/primers";
import { getUserStatusesBySlugs, toStatusMap } from "@/lib/data/sheets";
import { useAuth } from "@/components/providers/AuthProvider";
import { dataErrorMessage } from "@/lib/data/errors";
import { Button } from "@/components/ui/Button";
import { PatternChip } from "@/components/ui/Badge";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { PrimerListSkeleton } from "@/components/skeletons/PrimersSkeleton";
import { Primer, TriState } from "@/types/database";
import { cn } from "@/lib/utils";
import { useCachedQuery } from "@/lib/cache/query";

function primerHref(slug: string) {
  return `/primers/${slug}`;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function PrimerMeta({ primer, solved }: { primer: Primer; solved?: number | null }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs leading-4 text-text-tertiary md:font-sans md:text-sm md:leading-5 md:text-text-secondary">
      <span>{plural(primer.starter_slugs.length, "starter problem", "starter problems")}</span>
      <span aria-hidden className="text-text-tertiary">·</span>
      <span>{plural(primer.mistakes.length, "common mistake", "common mistakes")}</span>
      <span aria-hidden className="text-text-tertiary">·</span>
      <span className="inline-flex items-center gap-1 md:font-mono md:text-[13px] md:text-text-primary">
        <Clock className="hidden h-3.5 w-3.5 text-text-tertiary md:inline" strokeWidth={1.5} aria-hidden />
        about {primerReadMinutes(primer)} min read
      </span>
      {solved != null && (
        <>
          <span aria-hidden className="text-text-tertiary">·</span>
          <span>
            {solved} of {primer.starter_slugs.length} solved
          </span>
        </>
      )}
    </p>
  );
}

/**
 * Starter progress for a row. Statuses carry no verification source, so a
 * solved count is neutral, never emerald. Nothing renders when the count is
 * unknown (logged out or unreadable) — never a confident zero.
 */
function StarterProgress({ solved, total }: { solved: number | null; total: number }) {
  if (solved == null) return null;
  if (solved === 0) {
    return <span className="text-xs font-medium leading-4 text-text-tertiary">Not started</span>;
  }
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-hairline-strong px-2 font-mono text-xs font-medium leading-4 text-text-secondary tnum">
      <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
      {solved} of {total} solved
    </span>
  );
}

const NO_PRIMERS: Primer[] = [];
const NO_STATUSES: Record<string, TriState> = {};

export function PrimerList() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const primersQ = useCachedQuery(["list-primers"], listPrimers, {
    freshForMs: 10 * 60_000,
  });

  const myStatuses = useCachedQuery(
    userId ? ["my-statuses"] : null,
    async () => toStatusMap(await getUserStatusesBySlugs(userId as string))
  );

  const primers = primersQ.data ?? NO_PRIMERS;
  const statusMap = myStatuses.data ?? NO_STATUSES;

  const solvedCount = (p: Primer): number | null => {
    if (!userId || !myStatuses.data) return null;
    return p.starter_slugs.filter((s) => statusMap[s.toLowerCase()] === "solved").length;
  };

  if (primersQ.isLoading) return <PrimerListSkeleton />;
  if (primersQ.error && !primersQ.data) {
    return (
      <ErrorCard
        message={dataErrorMessage(primersQ.error, "Couldn't load primers.")}
        onRetry={() => void primersQ.refresh()}
      />
    );
  }
  if (primers.length === 0) {
    return (
      <EmptyState
        heading="No primers yet"
        body="Start with a practice battle instead — primers grow from real squad needs."
        action={
          <Link href="/practice">
            <Button variant="secondary">Practice</Button>
          </Link>
        }
      />
    );
  }

  // The recommended slot is honest by default: without battle history there is
  // no weakest pattern to name, so it points at the shortest starting read.
  const sorted = [...primers].sort((a, b) => a.starter_slugs.length - b.starter_slugs.length);
  const recommended = sorted[0];

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-label="Recommended primer"
        className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong md:p-6"
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-edge-highlight" />
        <div className="flex flex-wrap items-center gap-2">
          <PatternChip label={recommended.pattern} href={`/patterns/${encodeURIComponent(recommended.pattern)}`} />
          <span className="text-xs font-medium leading-4 text-text-tertiary">Start here</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="type-title text-text-primary">{recommended.title}</h2>
          <p className="text-[15px] leading-6 text-text-secondary md:text-sm md:leading-5">
            The shortest starting read. Your weakest-pattern pick appears here once you have battle
            history.
          </p>
        </div>
        <div className="flex flex-col gap-4 md:mt-1 md:flex-row md:items-center md:justify-between md:border-t md:border-hairline md:pt-4">
          <PrimerMeta primer={recommended} solved={solvedCount(recommended)} />
          <Link href={primerHref(recommended.slug)} className="md:shrink-0">
            <Button variant="primary" className="w-full font-semibold md:w-auto">
              Read primer
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
      </section>

      <section aria-label="All primers" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">All primers</h2>
          <span className="font-mono text-xs font-medium leading-4 text-text-tertiary tnum">
            {primers.length} available
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {sorted.map((p) => {
            const solved = solvedCount(p);
            return (
              <li key={p.slug}>
                <Link
                  href={primerHref(p.slug)}
                  className={cn(
                    "group flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:bg-surface-raised",
                    "md:h-14 md:flex-row md:items-center md:justify-between md:gap-3 md:rounded-md md:bg-surface/60 md:px-4 md:py-0"
                  )}
                >
                  <span className="flex items-start justify-between gap-2 md:contents">
                    <PatternChip label={p.pattern} className="shrink-0 self-start md:self-auto" />
                    <span className="md:order-last md:ml-auto md:flex md:shrink-0 md:items-center md:gap-3">
                      <StarterProgress solved={solved} total={p.starter_slugs.length} />
                      <ChevronRight
                        className="hidden h-4 w-4 text-text-tertiary transition-colors group-hover:text-text-primary md:block"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                  </span>
                  <span className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary md:min-w-0 md:truncate md:text-sm md:font-medium md:leading-5 md:tracking-normal">
                    {p.title}
                  </span>
                  <span className="font-mono text-xs leading-4 text-text-tertiary md:hidden lg:inline lg:shrink-0 lg:font-sans">
                    {plural(p.starter_slugs.length, "starter", "starters")} · {plural(p.mistakes.length, "mistake", "mistakes")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// Re-exported for tests that import the previous default shape.
export default PrimerList;
