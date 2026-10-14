"use client";

import { profileHref } from "@/lib/profiles/username";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getMyContentImpact, getForkChain, type ImpactRow, type ForkLink } from "@/lib/data/impact";
import { track } from "@/lib/analytics";

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
 */
export function MyImpact() {
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [chain, setChain] = useState<ForkLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [impact, links] = await Promise.all([
      getMyContentImpact().catch(() => [] as ImpactRow[]),
      getForkChain().catch(() => [] as ForkLink[]),
    ]);
    setRows(impact);
    setChain(links);
    setLoading(false);
    // Loop C only works if authors look at it; whether they do is the signal.
    if (impact.length > 0) {
      track("impact_panel_opened", { objects: impact.length, links: links.length });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-[11px] text-text-disabled">Checking what your writing has done…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-text-secondary">
          Nothing of yours has been copied yet.
        </p>
        <p className="text-[11px] text-text-tertiary">
          Publish an approach or a primer and this will show who picked it up —
          and whether they went on to solve the problem.
        </p>
        <Link
          href="/notebook"
          className="inline-block mt-1 px-4 py-2 rounded-full bg-surface-overlay text-text-secondary hover:text-text-primary cursor-pointer"
        >
          Write something
        </Link>
      </div>
    );
  }

  const totalCompletions = rows.reduce((n, r) => n + r.completions, 0);

  return (
    <div className="space-y-3">
      {totalCompletions > 0 && (
        <p className="text-xs text-text-secondary">
          <Sparkles className="w-3 h-3 inline text-primary mr-1" />
          {totalCompletions === 1
            ? "One developer solved a problem after copying something of yours."
            : `${totalCompletions} developers solved a problem after copying something of yours.`}
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={`${r.source_type}:${r.source_id}`}
            className="p-3 rounded-2xl bg-surface-overlay border border-hairline"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-text-disabled">
                  {r.source_type === "primer"
                    ? "primer"
                    : r.source_type === "approach"
                      ? "approach"
                      : "resource"}
                </div>
                <Link
                  href={
                    r.source_type === "primer"
                      ? `/primers/${r.slug ?? ""}`
                      : r.source_type === "approach"
                        ? `/approach/${r.source_id}`
                        : `/vault`
                  }
                  className="text-xs font-bold text-text-primary hover:text-primary transition-colors"
                >
                  {r.label}
                </Link>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-text-primary">{r.forks}</div>
                  <div className="text-[9px] uppercase tracking-wider text-text-disabled">copies</div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-lg font-bold font-mono ${r.completions > 0 ? "text-verified" : "text-text-disabled"}`}
                  >
                    {r.completions}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-text-disabled">solved</div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-text-tertiary mt-1.5">{r.headline}</p>
          </li>
        ))}
      </ul>

      {/* The chain: who took your writing, and who took theirs. */}
      {chain.length > 0 && (
        <div className="pt-2 border-t border-hairline">
          <h3 className="text-[10px] uppercase tracking-wider text-text-disabled mb-1.5">
            Who took it further
          </h3>
          <ul className="space-y-1">
            {chain.slice(0, 6).map((c) => (
              <li key={`${c.fork_id}`} className="text-[11px] text-text-tertiary">
                <Link href={profileHref(c.forker_username)} className="font-bold text-text-secondary hover:text-text-primary">
                  @{c.forker_username}
                </Link>{" "}
                copied{" "}
                <span className="text-text-secondary">{c.source_label}</span>
                {c.solved_at ? (
                  <span className="text-verified/80"> and solved it {c.solved_relative}</span>
                ) : (
                  <span className="text-text-disabled"> — no solve logged yet</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-text-disabled">
        A copy is somebody agreeing your writing was worth taking. A solve is them
        then solving the problem, within 30 days. The two are not the same thing,
        so they are not counted as one.
      </p>
    </div>
  );
}