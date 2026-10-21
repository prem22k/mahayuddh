"use client";

import { profileHref } from "@/lib/profiles/username";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getMyContentImpact, getForkChain, type ImpactRow, type ForkLink } from "@/lib/data/impact";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { ErrorCard, Skeleton } from "@/components/ui/States";

/**
 * Loop C author panel (Step 26, Bible §47, §56 Loop C).
 *
 * "Your primer helped 12 developers solve X" — the nudge §26 asks for, and the
 * only thing that makes writing more worth doing.
 *
 * Three rules it follows:
 *
 *   - Only objects somebody actually copied appear. A panel listing ten things
 *     with zero beside them teaches that writing does not matter.
 *   - A fork and a completion are shown separately. A copy is someone agreeing
 *     the writing was worth taking; a completion is someone then solving the
 *     problem. Collapsing them would let a popularity metric stand in for impact.
 *   - A fork with no completion says so plainly rather than implying the copy
 *     did something.
 *
 * Completions are solve logs, not LeetCode-verified proof, so they render in
 * neutral text rather than emerald.
 */
export function MyImpact() {
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [chain, setChain] = useState<ForkLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // The panel itself must load; a silent [] would read as "nothing of
      // yours was copied". The chain is secondary and may degrade to empty.
      const [impact, links] = await Promise.all([
        getMyContentImpact(),
        getForkChain().catch(() => [] as ForkLink[]),
      ]);
      setRows(impact);
      setChain(links);
      // Loop C only works if authors look at it; whether they do is the signal.
      if (impact.length > 0) {
        track("impact_panel_opened", { objects: impact.length, links: links.length });
      }
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load your impact. Retry."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Checking what your writing has done">
        <Skeleton className="h-[76px] w-full rounded-xl" />
        <Skeleton className="h-[76px] w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={() => void load()} />;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-4 md:p-6">
        <p className="text-[15px] font-medium leading-6 text-text-primary">Nothing of yours has been copied yet.</p>
        <p className="mt-1 max-w-reading text-sm leading-6 text-text-secondary">
          Publish an approach or a primer and this will show who picked it up — and whether they
          went on to solve the problem.
        </p>
        <Link
          href="/notebook"
          className="mt-4 inline-flex h-9 min-h-[44px] items-center rounded-md border border-hairline bg-surface-raised px-3 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-overlay md:min-h-0"
        >
          Write something
        </Link>
      </div>
    );
  }

  const totalCompletions = rows.reduce((n, r) => n + r.completions, 0);

  return (
    <div className="flex flex-col gap-4">
      {totalCompletions > 0 && (
        <p className="text-sm leading-6 text-text-secondary">
          {totalCompletions === 1
            ? "One developer solved a problem after copying something of yours."
            : `${totalCompletions} developers solved a problem after copying something of yours.`}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={`${r.source_type}:${r.source_id}`}
            className="rounded-xl border border-hairline bg-surface px-4 py-3.5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-medium leading-4 text-text-tertiary">
                  {r.source_type === "primer"
                    ? "Primer"
                    : r.source_type === "approach"
                      ? "Approach"
                      : "Resource"}
                </div>
                <Link
                  href={
                    r.source_type === "primer"
                      ? `/primers/${r.slug ?? ""}`
                      : r.source_type === "approach"
                        ? `/approach/${r.source_id}`
                        : `/vault`
                  }
                  className="mt-0.5 block text-[15px] font-semibold leading-[22px] tracking-[-0.01em] text-text-primary transition-colors hover:text-pattern"
                >
                  {r.label}
                </Link>
              </div>
              <div className="flex shrink-0 gap-4">
                <div className="text-right">
                  <div className="font-mono text-lg font-medium leading-6 text-text-primary tnum">{r.forks}</div>
                  <div className="text-xs leading-4 text-text-tertiary">copies</div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono text-lg font-medium leading-6 tnum ${r.completions > 0 ? "text-text-primary" : "text-text-tertiary"}`}
                  >
                    {r.completions}
                  </div>
                  <div className="text-xs leading-4 text-text-tertiary">solved</div>
                </div>
              </div>
            </div>
            <p className="mt-2 border-t border-hairline pt-2 text-xs leading-5 text-text-tertiary">{r.headline}</p>
          </li>
        ))}
      </ul>

      {/* The chain: who took your writing, and who took theirs. */}
      {chain.length > 0 && (
        <section className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
          <h3 className="text-sm font-medium leading-5 text-text-primary">Who took it further</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {chain.slice(0, 6).map((c) => (
              <li key={`${c.fork_id}`} className="text-sm leading-6 text-text-tertiary">
                <Link
                  href={profileHref(c.forker_username)}
                  className="font-medium text-text-secondary hover:text-text-primary"
                >
                  @{c.forker_username}
                </Link>{" "}
                copied <span className="text-text-secondary">{c.source_label}</span>
                {c.solved_at ? (
                  <span className="text-text-secondary"> and solved it {c.solved_relative}</span>
                ) : (
                  <span> — no solve logged yet</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="max-w-reading text-xs leading-5 text-text-tertiary">
        A copy is somebody agreeing your writing was worth taking. A solve is them
        then solving the problem, within 30 days. The two are not the same thing,
        so they are not counted as one.
      </p>
    </div>
  );
}
