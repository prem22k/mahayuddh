"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { PatternChip } from "@/components/ui/Badge";
import { dataErrorMessage } from "@/lib/data/errors";
import {
  getCatalogTopicsSummary,
  type CatalogTopicSummary,
} from "@/lib/data/problems";
import { getUserStatusesBySlugs } from "@/lib/data/sheets";

// Patterns index: every topic in the catalog with the caller's solved counts
// and a link to each hub. Solved counts come from the caller's own
// user_problem_status rows — logged-out readers see totals only, never zeros
// dressed as progress.
export default function PatternsPage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<CatalogTopicSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let statusMap = undefined;
        if (user) {
          try {
            const rows = await getUserStatusesBySlugs(user.id);
            // Lowercase keys: catalog slugs are lowercase, stored statuses
            // may not be, and a case mismatch must not silently drop solves.
            const map: Record<string, "solved" | "attempted" | "unsolved"> = {};
            for (const r of rows) map[r.problem_slug.toLowerCase()] = r.status;
            statusMap = map;
          } catch {
            // Statuses unreadable: fall through to totals-only rather than
            // failing the whole index.
            statusMap = undefined;
          }
        }
        const summary = await getCatalogTopicsSummary(statusMap);
        if (!cancelled) setTopics(summary);
      } catch (err) {
        if (!cancelled) setLoadError(dataErrorMessage(err, "Couldn't load patterns."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <ErrorCard message={loadError} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (topics === null) {
    return (
      <div className="space-y-6" aria-label="Loading patterns">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="type-display-md text-text-primary">Patterns</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Every pattern in the catalog, with your progress on each.
          </p>
        </div>
        <EmptyState
          heading="No patterns indexed yet"
          body="The catalog hasn't synced any topics. Try a practice battle instead."
          action={
            <Link
              href="/practice"
              className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
            >
              Practice
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-display-md text-text-primary">Patterns</h1>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-text-secondary">
          Every pattern in the catalog
          {user ? ", with your progress on each." : ". Log in to see your progress on each."}
        </p>
      </div>

      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={t.topic}>
            <Link
              href={`/patterns/${encodeURIComponent(t.topic)}`}
              className="card-interactive group flex min-h-[44px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
            >
              <PatternChip label={t.topic} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                  {t.topic}
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-text-tertiary tnum">
                  {user ? `${t.solved} of ${t.count} solved` : `${t.count} problems`}
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
    </div>
  );
}
