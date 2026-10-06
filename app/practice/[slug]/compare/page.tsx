"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApproachesForProblem } from "@/lib/data/approaches";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import {
  buildComparison,
  isComparable,
  differences,
  CompareRow,
} from "@/lib/approachCompare";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import type { Approach, Problem } from "@/types/database";

/**
 * Approach comparison (Step 19, Bible §13).
 *
 * Grouped by technique, not by author: the point is to see how people solved
 * the same problem differently. Code is collapsed until you explicitly open it,
 * so comparing ideas does not become copying answers (§12).
 *
 * There is deliberately no winner here. Not a "best approach", not a sort, not
 * a score — the module that builds this has no vocabulary for ranking.
 */
export default function ComparePage() {
  const params = useParams<{ slug: string }>();
  const slug = (params.slug ?? "").toLowerCase();
  const { user } = useAuth();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalog, rows] = await Promise.all([
        getCatalogBySlugs([slug]).catch(() => []),
        getApproachesForProblem(slug),
      ]);
      setProblem(catalog[0] ?? null);
      setApproaches(rows);
      if (rows.length >= 2) {
        track("compare_viewed", { problem_slug: slug, count: rows.length });
      }
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load approaches. Retry."));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader label="Loading approaches..." />;

  if (loadError) {
    return (
      <div role="alert" className="p-12 text-center space-y-3">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-full btn-accent text-white text-xs font-bold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const title = problem?.title ?? slug;
  const comparison = buildComparison(approaches);

  return (
    <div className="space-y-8 select-none max-w-4xl">
      <Link
        href={`/practice/${slug}`}
        className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{title}</span>
      </Link>

      <header className="space-y-2">
        <div className="text-[11px] font-bold text-[#0a84ff] tracking-[0.2em] uppercase">
          Side by side
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          How your squad solved {title}
        </h1>
        <p className="text-xs text-white/55 max-w-2xl leading-relaxed">
          {comparison.total} shared {comparison.total === 1 ? "approach" : "approaches"},
          {comparison.techniqueCount > 0 ? ` using ${comparison.techniqueCount} different ` : " using "}
          {comparison.techniqueCount === 1 ? "technique" : "techniques"}. Read for the ideas, not the
          winner — there isn&apos;t one here.
        </p>
      </header>

      {!isComparable(comparison.total) ? (
        <div className="p-12 text-center space-y-3 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-sm font-bold text-white">
            {comparison.total === 0
              ? "Nobody has shared an approach for this yet."
              : "Only one approach so far — nothing to compare against."}
          </p>
          <p className="text-xs text-white/55 max-w-sm mx-auto">
            Approaches are shared when their author chooses Squad or Public. Private ones stay
            private and never appear here.
          </p>
          <Link
            href={`/practice/${slug}#explain`}
            className="inline-block px-4 py-2 rounded-full btn-accent text-white text-xs font-bold"
          >
            Write yours
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {comparison.groups.map((group) => (
            <section key={group.technique} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-white">{group.label}</h2>
                <span className="text-[10px] text-white/50 font-mono">
                  {group.rows.length}{" "}
                  {group.rows.length === 1 ? "person" : "people"} solved it this way
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.rows.map((row) => (
                  <ApproachCard
                    key={row.approach.id}
                    row={row}
                    mine={row.approach.user_id === user?.id}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Neutral observations across the whole set. */}
          {crossGroupDifferences(comparison.groups.flatMap((g) => g.rows)).length > 0 && (
            <section className="space-y-2 p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
              <h2 className="text-sm font-bold text-white">Where they differ</h2>
              <ul className="space-y-1.5">
                {crossGroupDifferences(comparison.groups.flatMap((g) => g.rows)).map((d, i) => (
                  <li key={i} className="text-xs text-white/50 leading-relaxed">
                    · {d}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** Unique, neutral differences across the whole set. */
function crossGroupDifferences(rows: CompareRow[]): string[] {
  const out = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      for (const d of differences(rows[i], rows[j])) out.add(d);
    }
  }
  return Array.from(out).slice(0, 8);
}

function ApproachCard({ row, mine }: { row: CompareRow; mine: boolean }) {
  const [showCode, setShowCode] = useState(false);
  const a = row.approach;

  return (
    <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-white">
          @{a.author?.username ?? a.author_profile?.username ?? "member"}
        </span>
        {mine && (
          <span className="text-[10px] font-bold text-[#fa586a] uppercase">you</span>
        )}
      </div>

      <p className="text-xs text-white/75 leading-relaxed whitespace-pre-wrap">
        {a.core_idea}
      </p>

      {(row.time || row.space) && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-white/55">
          {row.time && <span>time {row.time}</span>}
          {row.space && <span>· space {row.space}</span>}
        </div>
      )}

      {a.key_detail && (
        <p className="text-[11px] text-white/50">
          <span className="text-white/50 font-semibold uppercase tracking-wider text-[9px] mr-1.5">
            key detail
          </span>
          {a.key_detail}
        </p>
      )}
      {a.edge_cases && (
        <p className="text-[11px] text-white/50">
          <span className="text-white/50 font-semibold uppercase tracking-wider text-[9px] mr-1.5">
            edge cases
          </span>
          {a.edge_cases}
        </p>
      )}
      {a.mistakes && (
        <p className="text-[11px] text-white/50">
          <span className="text-white/50 font-semibold uppercase tracking-wider text-[9px] mr-1.5">
            mistakes
          </span>
          {a.mistakes}
        </p>
      )}

      {a.code && (
        <div className="border-t border-white/[0.06] pt-2">
          <button
            onClick={() => setShowCode((v) => !v)}
            className="text-[11px] font-bold text-white/60 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            {showCode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showCode ? "Hide code" : "Reveal code"}
          </button>
          {!showCode && (
            <p className="text-[10px] text-white/25 mt-1">
              Collapsed so you compare the ideas first.
            </p>
          )}
          {showCode && (
            <pre
              className={cn(
                "mt-2 p-3 rounded-2xl bg-black/40 text-[11px] text-white/70 overflow-x-auto"
              )}
            >
              <code>{a.code}</code>
            </pre>
          )}
        </div>
      )}

      <Link
        href={`/approach/${a.id}`}
        className="inline-block text-[11px] font-bold text-[#0a84ff] hover:underline"
      >
        Read in full →
      </Link>
    </div>
  );
}
