"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listPrimers, primerReadMinutes } from "@/lib/data/primers";
import { getUserStatusesBySlugs } from "@/lib/data/sheets";
import { useAuth } from "@/components/providers/AuthProvider";
import { dataErrorMessage } from "@/lib/data/errors";
import { Button } from "@/components/ui/Button";
import { PatternChip } from "@/components/ui/Badge";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { Primer } from "@/types/database";

function primerHref(slug: string) {
  return `/primers/${slug}`;
}

function PrimerMeta({ primer, solved }: { primer: Primer; solved?: number | null }) {
  return (
    <p className="mt-1 text-sm leading-6 text-text-secondary">
      {primer.starter_slugs.length} starter {primer.starter_slugs.length === 1 ? "problem" : "problems"} ·{" "}
      {primer.mistakes.length} common {primer.mistakes.length === 1 ? "mistake" : "mistakes"} ·{" "}
      about {primerReadMinutes(primer)} min read
      {solved != null && ` · ${solved} of ${primer.starter_slugs.length} solved`}
    </p>
  );
}

export function PrimerList() {
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Starter progress from the reader's own statuses — null when logged out or
  // unreadable, in which case no progress renders (never a confident zero).
  const [solvedSlugs, setSolvedSlugs] = useState<Set<string> | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    listPrimers()
      .then(setPrimers)
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load primers.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setSolvedSlugs(null);
      return;
    }
    let cancelled = false;
    getUserStatusesBySlugs(user.id)
      .then((rows) => {
        if (cancelled) return;
        setSolvedSlugs(
          new Set(
            rows.filter((r) => r.status === "solved").map((r) => r.problem_slug.toLowerCase())
          )
        );
      })
      .catch(() => {
        if (!cancelled) setSolvedSlugs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const solvedCount = (p: Primer): number | null => {
    if (!solvedSlugs) return null;
    return p.starter_slugs.filter((s) => solvedSlugs.has(s.toLowerCase())).length;
  };

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Loading primers">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (loadError) {
    return <ErrorCard message={loadError} onRetry={() => window.location.reload()} />;
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
  const [recommended, ...rest] = [...primers].sort(
    (a, b) => a.starter_slugs.length - b.starter_slugs.length
  );

  return (
    <div className="space-y-8">
      <section aria-label="Recommended primer" className="card">
        <div className="flex flex-wrap items-center gap-2">
          <PatternChip label={recommended.pattern} href={`/patterns/${encodeURIComponent(recommended.pattern)}`} />
          <span className="text-xs leading-4 text-text-tertiary">Start here</span>
        </div>
        <h2 className="type-title mt-2 text-text-primary">{recommended.title}</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          The shortest starting read. Your weakest-pattern pick appears here once you have battle
          history.
        </p>
        <PrimerMeta primer={recommended} solved={solvedCount(recommended)} />
        <div className="mt-4">
          <Link href={primerHref(recommended.slug)}>
            <Button variant="primary">Read primer</Button>
          </Link>
        </div>
      </section>

      <section aria-label="All primers" className="space-y-2">
        <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">All primers</h2>
        <ul className="space-y-2">
          {rest.map((p) => (
            <li key={p.slug}>
              <Link
                href={primerHref(p.slug)}
                className="card-interactive group flex min-h-[44px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
              >
                <PatternChip label={p.pattern} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                    {p.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs leading-4 text-text-tertiary">
                    {p.starter_slugs.length} starters · {p.mistakes.length} mistakes · about{" "}
                    {primerReadMinutes(p)} min read
                    {solvedCount(p) != null && ` · ${solvedCount(p)} of ${p.starter_slugs.length} solved`}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary"
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Re-exported for tests that import the previous default shape.
export default PrimerList;
