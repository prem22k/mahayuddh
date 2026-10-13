"use client";

import React, { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { difficultyBadgeClass } from "@/components/ui/DifficultyBadge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { useSolving } from "@/components/providers/SolvingProvider";
import { pickDailyBattle, formatDuration, DailyPick, ProblemHistory } from "@/lib/dailyBattle";
import { copyText } from "@/lib/clipboard";
import { getSlugSquadActivity } from "@/lib/data/squads";
import { getProblemHistory, cacheDailyBattle } from "@/lib/data/dailyBattles";
import { getBattlesForSlug } from "@/lib/data/battles";
import { DPPattern } from "@/components/vectors/BentoPatterns";
import type { ListProblem, TriState } from "@/types/database";

interface TodaysBattleProps {
  problems: ListProblem[];
  statusMap: Record<string, TriState>;
  userId?: string | null;
  /** Real squad id, or null when solo. Gates the "your squad" label. */
  squadId?: string | null;
  /** Member ids of that squad only. Never "all profiles". */
  squadMemberIds?: string[];
  goalPattern?: string | null;
  squadSlugs?: Set<string>;
}

/**
 * TODAY'S BATTLE hero (Bible §6): one problem, truthful why, single START BATTLE CTA.
 *
 * Truthfulness rules enforced here:
 *   - "your squad" only renders when the caller actually belongs to a squad
 *   - personal best only renders when we have a real solved duration
 *   - every post-solve next action is a real, wired link (no dead ends, §P9)
 */
export function TodaysBattle({
  problems,
  statusMap,
  userId,
  squadId = null,
  squadMemberIds = [],
  goalPattern = null,
  squadSlugs,
}: TodaysBattleProps) {
  const { startSolving } = useSolving();
  const [history, setHistory] = useState<Map<string, ProblemHistory> | null>(null);

  // Failure-rate + gap signals need problem_events, not just current status.
  useEffect(() => {
    if (!userId) {
      setHistory(new Map());
      return;
    }
    getProblemHistory(problems.map((p) => p.title_slug))
      .then(setHistory)
      .catch(() => setHistory(new Map()));
  }, [userId, problems]);

  const computed = useMemo(
    () =>
      pickDailyBattle({
        problems,
        statusMap,
        userId,
        squadSlugs,
        goalPattern,
        history: history ?? undefined,
      }),
    [problems, statusMap, userId, squadSlugs, goalPattern, history]
  );

  // Squad activity is a separate, honest lookup scoped to real squad members.
  const [activity, setActivity] = useState<{ attempted: number; total: number } | null>(null);
  useEffect(() => {
    if (!computed || squadMemberIds.length === 0) {
      setActivity(null);
      return;
    }
    getSlugSquadActivity(computed.problem.title_slug, squadMemberIds)
      .then(setActivity)
      .catch(() => setActivity(null));
  }, [computed?.problem.title_slug, squadMemberIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useMemo<DailyPick | null>(() => {
    if (!computed) return null;
    return { ...computed, squadContext: squadId ? activity : null };
  }, [computed, activity, squadId]);

  // Persist today's pick so a mid-day list change can't re-roll it.
  useEffect(() => {
    if (pick && userId) {
      cacheDailyBattle(userId, pick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick?.problem.title_slug, userId]);

  const pickSlug = computed?.problem.title_slug.toLowerCase() ?? "";
  const solved = pickSlug ? statusMap[pickSlug] === "solved" : false;
  const slug = pickSlug;

  // Last solved duration for this problem, so the post-solve header can say
  // "Solved in 24:17" instead of a bare badge (plan Step 6).
  const [lastSolveSec, setLastSolveSec] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!solved || !slug) {
      setLastSolveSec(null);
      return;
    }
    getBattlesForSlug(slug, 20)
      .then((rows) => {
        const secs = rows
          .filter((b) => b.outcome === "solved" && b.duration_sec != null)
          .map((b) => b.duration_sec as number);
        setLastSolveSec(secs.length ? Math.min(...secs) : null);
      })
      .catch(() => setLastSolveSec(null));
  }, [solved, slug]);

  if (!pick) return null;
  const { problem: potd, why, squadContext, personalBest } = pick;

  return (
    <div className="relative col-span-1 md:col-span-2 min-h-[260px] rounded-xl p-6 overflow-hidden card flex flex-col justify-between group">
      <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
        <DPPattern />
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[11px] font-semibold text-text-secondary">
            Today&apos;s battle
          </span>
        </div>
        <div className="flex items-center gap-2">
          {solved && (
            <span className="px-2 py-0.5 rounded-full bg-verified-tint border border-verified/30 text-verified text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Solved</span>
            </span>
          )}
          <span className="text-xs font-mono font-bold text-text-tertiary">#{potd.order_index}</span>
        </div>
      </div>

      <div className="relative z-10 my-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", difficultyBadgeClass())}>
            {potd.difficulty}
          </span>
          <span className="text-xs text-text-tertiary font-medium">{potd.category}</span>
        </div>
        <h3 className="text-2xl md:text-3xl font-semibold text-text-primary tracking-tight leading-snug">{potd.title}</h3>
        {why.length > 0 && (
          <p className="text-[11px] text-text-tertiary mt-1.5">Why this problem: {why.join(" ")}</p>
        )}
        {/* Squad line only when the caller is actually in a squad. */}
        {squadContext && squadContext.total > 0 && (
          <p className="text-[11px] text-text-tertiary mt-0.5 font-mono">
            Your squad: {squadContext.attempted} / {squadContext.total} attempted it.
          </p>
        )}
        {/* Personal best only when we have a real solved duration on record. */}
        {personalBest && (
          <p className="text-[11px] text-text-tertiary mt-0.5 font-mono">Your best: {personalBest}</p>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between pt-2 border-t border-hairline flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              startSolving({
                id: potd.order_index,
                title: potd.title,
                slug: potd.title_slug,
                difficulty: potd.difficulty,
                category: potd.category,
              })
            }
            className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{solved ? "Solve Again" : "Start Battle"}</span>
          </button>
          <ProblemLink
            slug={potd.title_slug}
            className="p-2 rounded-full bg-surface-overlay hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-all border border-hairline"
          />
        </div>
        <span className="text-[11px] text-text-tertiary font-mono hidden sm:inline">Dock Solver Ready</span>
      </div>

      {/* ── Post-solve next actions. Every one is wired (Bible Principle 9). ── */}
      {solved && lastSolveSec != null && (
        <div className="relative z-10 mt-3 pt-3 border-t border-hairline">
          <p className="text-xs font-bold text-verified">
            Solved in {formatDuration(lastSolveSec)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Link
              href={`/practice/${slug}#explain`}
              className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all"
            >
              Explain your approach
            </Link>
            <Link
              href={`/challenges?problem=${slug}&title=${encodeURIComponent(potd.title)}&difficulty=${potd.difficulty}&time=${lastSolveSec}`}
              className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all"
            >
              Challenge someone
            </Link>
            <Link
              href="/practice"
              className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all"
            >
              Revisit later
            </Link>
            <button
              onClick={async () => {
                if (await copyText(`${window.location.origin}/practice/${slug}`)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer"
            >
              {copied ? "Link copied" : "Share"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
