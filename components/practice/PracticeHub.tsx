"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { listPrimers } from "@/lib/data/primers";
import {
  refreshReviewQueue,
  getSnapshot,
  computePatternStats,
  PatternStat,
} from "@/lib/data/review";
import { buildRevengeOffer, revengeLabel, RevengeOffer } from "@/lib/revenge";
import { getOpenRevenges } from "@/lib/data/revenge";
import { dataErrorMessage } from "@/lib/data/errors";
import { Primer, Problem, ReviewItem, ReviewReason } from "@/types/database";

const REASON_LABEL: Record<ReviewReason, string> = {
  failed: "Failed — take revenge",
  gap: "Fading — revisit",
  weak_pattern: "Weak pattern",
  bookmark: "Bookmarked",
  low_confidence: "Low confidence",
};

export function PracticeHub() {
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [patterns, setPatterns] = useState<PatternStat[]>([]);
  const [titles, setTitles] = useState<Map<string, Problem>>(new Map());
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [revenges, setRevenges] = useState<Map<string, RevengeOffer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([refreshReviewQueue().catch(() => [] as ReviewItem[]), getSnapshot().catch(() => null), listPrimers().catch(() => [] as Primer[])])
      .then(async ([rows, snap, prim]) => {
        setReviews(rows);
        setPrimers(prim);
        if (snap) {
          setPatterns(computePatternStats(snap));
          const slugs = Array.from(new Set(rows.map((r) => r.problem_slug))).slice(0, 60);
          const catalog = await getCatalogBySlugs(slugs).catch(() => []);
          setTitles(new Map(catalog.map((c) => [c.title_slug, c])));

          // Revenge (Step 17): a failed problem with its real failure time on it,
          // rather than a bare "Failed" label.
          const failedSlugs = rows.filter((r) => r.reason === "failed").map((r) => r.problem_slug);
          if (failedSlugs.length > 0) {
            const battlesBySlug = await getOpenRevenges(failedSlugs).catch(() => new Map());
            const offers = new Map<string, RevengeOffer>();
            for (const slug of failedSlugs) {
              const offer = buildRevengeOffer(slug, battlesBySlug.get(slug) ?? []);
              if (offer) offers.set(slug, offer);
            }
            setRevenges(offers);
          } else {
            setRevenges(new Map());
          }
        }
      })
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load practice data.")))
      .finally(() => setLoading(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
        <p className="text-sm font-bold text-white">Log in to get your revision queue.</p>
        <Link href="/login" className="inline-block px-4 py-2 rounded-full btn-accent text-white text-xs font-bold">Log in</Link>
      </div>
    );
  }
  if (loading) return <PageLoader label="Computing your review queue..." className="h-40" />;
  if (loadError) {
    return (
      <div role="alert" className="p-6 text-center rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
      </div>
    );
  }

  const weak = patterns.filter((p) => p.status === "Weak").slice(0, 6);

  const startRevision = (slug: string) => {
    const meta = titles.get(slug);
    startSolving({
      id: meta?.question_id || slug,
      title: meta?.title || slug,
      slug,
      difficulty: meta?.difficulty || "Medium",
      category: meta?.topics?.[0] || "Revision",
    });
  };

  return (
    <div className="space-y-8">
      {/* Review due */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">
          Review due {reviews.length > 0 && <span className="text-[#fa586a]">({reviews.length})</span>}
        </h2>
        {reviews.length === 0 ? (
          <p className="text-xs text-white/50 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            Nothing due. Failed battles, fading solves, and bookmarks will queue here automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {reviews.slice(0, 12).map((r) => {
              const meta = titles.get(r.problem_slug);
              const revenge = revenges.get(r.problem_slug);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3.5 rounded-2xl border",
                    revenge
                      ? "bg-[#ff9f0a]/[0.06] border-[#ff9f0a]/25"
                      : "bg-white/[0.02] border-white/[0.06]"
                  )}
                >
                  <div className="min-w-0">
                    <Link href={`/practice/${r.problem_slug}`} className="text-xs font-bold text-white hover:text-[#fa586a] transition-colors truncate block">
                      {meta?.title || r.problem_slug}
                    </Link>
                    <span className="text-[10px] text-white/55">
                      {/* Revenge shows the real previous time; other reasons keep
                          their plain label. Never invent a duration. */}
                      {revenge
                        ? revengeLabel(revenge)
                        : `${REASON_LABEL[r.reason]}${meta ? ` · ${meta.difficulty}` : ""}`}
                    </span>
                  </div>
                  <button onClick={() => startRevision(r.problem_slug)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer",
                      revenge
                        ? "bg-[#ff9f0a] text-black hover:bg-[#ff9f0a]/90"
                        : "bg-white text-black hover:bg-white/90"
                    )}>
                    <Play className="w-3 h-3 fill-current" />
                    <span>{revenge ? "Take revenge" : r.reason === "failed" ? "Retry" : "Start revision"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Weak patterns */}
      {weak.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white">Weak patterns <span className="text-white/50 font-normal text-[11px]">· estimate, not proof</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {weak.map((p) => (
              <Link key={p.pattern} href={`/patterns/${encodeURIComponent(p.pattern)}`}
                className="p-4 rounded-2xl bg-[#ff9f0a]/[0.05] border border-[#ff9f0a]/20 hover:border-[#ff9f0a]/40 transition-all">
                <div className="text-xs font-bold text-white">{p.pattern}</div>
                <div className="text-[11px] text-white/55 mt-1 font-mono">
                  {p.solved} solved · {p.failures} failed · {p.revisits} revisits
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Continue: primers */}
      {primers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white">Learn a pattern first</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {primers.map((p) => (
              <Link key={p.slug} href={`/primers/${p.slug}`}
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
                <div className="text-[10px] font-bold text-[#fa586a] uppercase tracking-widest">{p.pattern}</div>
                <div className="text-[11px] font-bold text-white mt-0.5">{p.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* New: roadmaps */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">Go new</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { slug: "neetcode-150", title: "NeetCode 150" },
            { slug: "blind-75", title: "Blind 75" },
            { slug: "striver-sde", title: "Striver SDE Sheet" },
          ].map((r) => (
            <Link key={r.slug} href={`/sheets/${r.slug}`}
              className={cn("p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-xs font-bold text-white transition-all")}>
              {r.title} →
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
