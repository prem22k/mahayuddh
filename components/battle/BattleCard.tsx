"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Check, Link2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { difficultyBadgeClass } from "@/components/ui/DifficultyBadge";
import { copyText } from "@/lib/clipboard";
import { track } from "@/lib/analytics";
import { useSolving } from "@/components/providers/SolvingProvider";
import {
  BattleCardCore,
  BattleCardFull,
  BattleCardPublic,
  formatDuration,
} from "@/lib/battleCard";

type Card = BattleCardCore | BattleCardFull | BattleCardPublic;

function isFull(card: Card): card is BattleCardFull {
  return "ownerId" in card;
}

function isPublic(card: Card): card is BattleCardPublic {
  return "hasSharedApproach" in card;
}

/**
 * BATTLE CARD (Step 16, Bible §7).
 *
 * The canonical artifact for one solve. Restrained vocabulary on purpose — no
 * XP, no tiers, no confetti here (§Principle 8). Every action is wired; the
 * plan explicitly forbids dead ends.
 */
export function BattleCard({
  battleId,
  onCompareAvailable,
}: {
  battleId: string;
  /** Show "Compare approaches" only when the problem actually has ≥2. */
  onCompareAvailable?: boolean;
}) {
  const router = useRouter();
  const { startSolving } = useSolving();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [squadMembers, setSquadMembers] = useState<{ id: string; username: string }[]>([]);
  const [target, setTarget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/battle-cards/${battleId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't load this card.");
      setCard(json.card as Card);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this card.");
    } finally {
      setLoading(false);
    }
  }, [battleId]);

  useEffect(() => {
    load();
  }, [load]);

  // Squad members are the only people you can challenge from a card: the
  // challenge flow is deliberately not a global user directory (§61).
  const openChallenge = async () => {
    setChallenging(true);
    try {
      const { getActiveSquadMembers } = await import("@/lib/data/squads");
      const members = await getActiveSquadMembers();
      setSquadMembers(members);
      if (members.length > 0) setTarget(members[0].id);
    } catch {
      setError("Couldn't load your squad. Join one to challenge someone.");
    } finally {
      setChallenging(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="h-3 w-24 rounded-full bg-white/[0.06] animate-pulse" />
        <div className="mt-3 h-6 w-48 rounded-full bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div role="alert" className="rounded-3xl border border-[#ff453a]/30 bg-[#ff453a]/10 p-5 space-y-3">
        <p className="text-xs text-[#ff453a]">{error ?? "Card unavailable."}</p>
        <button
          onClick={load}
          className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 hover:bg-[#ff453a]/25 border border-[#ff453a]/30 text-[#ff453a] text-xs font-bold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const solvedLabel = card.solvedSec != null ? formatDuration(card.solvedSec) : null;
  const prevLabel = card.previousBestSec != null ? formatDuration(card.previousBestSec) : null;
  const failed = "outcome" in card && card.outcome === "failed";
  const approachId = isFull(card) ? card.approachId : null;
  const hasApproach = isFull(card)
    ? Boolean(card.approachExcerpt)
    : isPublic(card)
      ? card.hasSharedApproach
      : false;

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/b/${battleId}` : `/b/${battleId}`;

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">
              Battle
            </span>
            {card.difficulty && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                  difficultyBadgeClass(card.difficulty as "Easy" | "Medium" | "Hard")
                )}
              >
                {card.difficulty}
              </span>
            )}
            {card.pattern && (
              <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-bold text-white/60">
                {card.pattern}
              </span>
            )}
            {card.isPersonalRecord && (
              <span className="px-2 py-0.5 rounded-full bg-[#30d158]/15 border border-[#30d158]/30 text-[10px] font-bold text-[#30d158]">
                Personal best
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-xl font-extrabold text-white tracking-tight">
            {card.title}
          </h3>
        </div>

        <div className="text-right shrink-0">
          {failed ? (
            <>
              <div className="text-2xl font-black text-[#ff9f0a] font-mono leading-none">Failed</div>
              <div className="text-[11px] text-white/40 mt-0.5">Revenge available</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-black text-white font-mono leading-none">
                {solvedLabel ?? "—"}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">
                {prevLabel ? (
                  <>
                    Previous best{" "}
                    <span className="font-mono text-white/60">{prevLabel}</span>
                  </>
                ) : (
                  "First timed solve"
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Honest provenance: solved is not the same as understood (§44). */}
      <div className="flex items-center gap-3 text-[11px] text-white/40 flex-wrap">
        <span>{card.stats.attempts} attempts</span>
        {card.stats.revisits > 0 && <span>· {card.stats.revisits} revisits</span>}
        {card.stats.challengesSent > 0 && <span>· {card.stats.challengesSent} challenged out</span>}
        {card.stats.friendsCompleted > 0 && (
          <span>· {card.stats.friendsCompleted} friends completed</span>
        )}
        <span>· {card.evidence === "leetcode" ? "LeetCode evidence" : "self-reported"}</span>
        {isFull(card) && card.evidence === "none" && (
          <span className="text-white/25">— neither proves understanding</span>
        )}
      </div>

      {isFull(card) && card.approachExcerpt && (
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1">
            Your approach
          </div>
          <p className="text-xs text-white/70 leading-relaxed">{card.approachExcerpt}</p>
        </div>
      )}

      {/* ── Actions. Every one wired (Principle 9). ── */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          onClick={() =>
            startSolving({
              id: 1,
              title: card.title,
              slug: card.problemSlug,
              difficulty: card.difficulty ?? "Medium",
              category: card.pattern ?? "Practice",
            })
          }
          className="px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{failed ? "Take revenge" : "Revisit"}</span>
        </button>

        <button
          onClick={async () => {
            if (challenging) return;
            await openChallenge();
          }}
          className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all cursor-pointer"
        >
          Challenge someone
        </button>

        {hasApproach && approachId ? (
          <Link
            href={`/approach/${approachId}`}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all"
          >
            {isFull(card) ? "Read your approach" : "Read approach"}
          </Link>
        ) : (
          <Link
            href={`/practice/${card.problemSlug}#explain`}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all"
          >
            Add approach
          </Link>
        )}

        {onCompareAvailable && (
          <Link
            href={`/practice/${card.problemSlug}/compare`}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all flex items-center gap-1.5"
          >
            <ExternalLink className="w-3 h-3" />
            Compare squad approaches
          </Link>
        )}

        <button
          onClick={async () => {
            if (!(await copyText(shareUrl))) return;
            track("share_clicked", { artifact: "battle", battle_id: battleId });
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="ml-auto px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
          title="Copy share link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Link2 className="w-3.5 h-3.5" />}
          <span>{copied ? "Link copied" : "Share"}</span>
        </button>
      </div>

      {/* Challenge picker. Squad members only — no global user search (§61). */}
      {squadMembers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] text-white/40">Challenge</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5 text-[11px] text-white cursor-pointer"
          >
            {squadMembers.map((m) => (
              <option key={m.id} value={m.id}>
                @{m.username}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const secs = card.solvedSec;
              const params = new URLSearchParams({
                problem: card.problemSlug,
                title: card.title,
                difficulty: card.difficulty ?? "Medium",
                to: target,
              });
              if (secs != null) params.set("time", String(secs));
              router.push(`/challenges?${params.toString()}`);
            }}
            className="px-3 py-1.5 rounded-full bg-[#fa586a] text-white text-[11px] font-bold transition-all cursor-pointer"
          >
            Send challenge
          </button>
        </div>
      )}
    </div>
  );
}
