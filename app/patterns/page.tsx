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
import { SplitBar } from "@/components/matrix/SplitBar";

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
      <div className="flex flex-col gap-6 md:gap-8" aria-label="Loading patterns">
        <div className="space-y-3">
          <Skeleton className="h-9 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <section className="flex flex-col gap-3">
          <h1 className="type-display-md text-text-primary">Patterns</h1>
          <p className="max-w-3xl text-[15px] leading-6 text-text-secondary md:text-[17px] md:leading-7">
            Every pattern in the catalog, with your progress on each.
          </p>
        </section>
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
    <div className="flex flex-col gap-6 md:gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-display-md text-text-primary">Patterns</h1>
          <PatternChip
            label={`${topics.length} indexed`}
            className="h-6 border border-pattern/30 font-mono text-xs uppercase tracking-[0.06em] tnum"
          />
        </div>
        <p className="max-w-3xl text-[15px] leading-6 text-text-secondary md:text-[17px] md:leading-7">
          Every pattern in the catalog
          {user ? ", with your progress on each." : ". Log in to see your progress on each."}
        </p>
      </section>

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
        {topics.map((t) => (
          <li key={t.topic}>
            <Link
              href={`/patterns/${encodeURIComponent(t.topic)}`}
              className="group flex min-h-14 items-center gap-4 rounded-lg border border-hairline bg-surface px-4 py-3 transition-colors hover:border-hairline-strong hover:bg-surface-raised"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium leading-6 text-text-primary">
                  {t.topic}
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-text-tertiary tnum">
                  {user ? (
                    <>
                      <span className="text-text-secondary">{t.solved}</span> of {t.count} solved
                      {t.attempted > 0 && <> · {t.attempted} attempted</>}
                    </>
                  ) : (
                    `${t.count} problems`
                  )}
                </span>
              </span>
              {user && (
                <SplitBar
                  total={t.count}
                  verified={0}
                  selfReported={t.solved}
                  label={`${t.topic} solved`}
                  className="hidden h-1.5 w-20 shrink-0 sm:flex"
                />
              )}
              <ChevronRight
                className="h-4 w-4 shrink-0 text-text-tertiary transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text-primary"
                strokeWidth={1.5}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
