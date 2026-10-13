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
      <div className="rounded-xl border border-hairline bg-surface-overlay p-5">
        <div className="h-3 w-24 rounded-full bg-surface-overlay animate-pulse" />
        <div className="mt-3 h-6 w-48 rounded-full bg-surface-overlay animate-pulse" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div role="alert" className="rounded-xl border border-error/30 bg-error-tint p-5 space-y-3">
        <p className="text-xs text-error">{error ?? "Card unavailable."}</p>
        <button
          onClick={load}
          className="px-4 py-1.5 rounded-full bg-error/15 hover:bg-error/25 border border-error/30 text-error text-xs font-bold cursor-pointer"
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
    <div className="rounded-xl border border-hairline bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {card.difficulty && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                  difficultyBadgeClass()
                )}
              >
                {card.difficulty}
              </span>
            )}
            {card.pattern && (
              <span className="px-2 py-0.5 rounded-full bg-surface-overlay border border-hairline text-[10px] font-bold text-text-secondary">
                {card.pattern}
              </span>
            )}
            {card.isPersonalRecord && (
              <span className="px-2 py-0.5 rounded-full bg-verified-tint border border-verified/30 text-[10px] font-bold text-verified">
                Personal best
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-xl font-semibold text-text-primary tracking-tight">
            {card.title}
          </h3>
        </div>

        <div className="text-right shrink-0">
          {failed ? (
            <>
              <div className="text-2xl font-bold text-primary font-mono leading-none">Failed</div>
              <div className="text-[11px] text-text-tertiary mt-0.5">Revenge available</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-text-primary font-mono leading-none">
                {solvedLabel ?? "—"}
              </div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                {prevLabel ? (
                  <>
                    Previous best{" "}
                    <span className="font-mono text-text-secondary">{prevLabel}</span>
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
      <div className="flex items-center gap-3 text-[11px] text-text-tertiary flex-wrap">
        <span>{card.stats.attempts} attempts</span>
        {card.stats.revisits > 0 && <span>· {card.stats.revisits} revisits</span>}
        {card.stats.challengesSent > 0 && <span>· {card.stats.challengesSent} challenged out</span>}
        {card.stats.friendsCompleted > 0 && (
          <span>· {card.stats.friendsCompleted} friends completed</span>
        )}
        <span>· {card.evidence === "leetcode" ? "LeetCode evidence" : "self-reported"}</span>
        {isFull(card) && card.evidence === "none" && (
          <span className="text-text-disabled">— neither proves understanding</span>
        )}
      </div>

      {isFull(card) && card.approachExcerpt && (
        <div className="rounded-2xl border border-hairline bg-black/20 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
            Your approach
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{card.approachExcerpt}</p>
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
          className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{failed ? "Take revenge" : "Revisit"}</span>
        </button>

        <button
          onClick={async () => {
            if (challenging) return;
            await openChallenge();
          }}
          className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer"
        >
          Challenge someone
        </button>

        {hasApproach && approachId ? (
          <Link
            href={`/approach/${approachId}`}
            className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all"
          >
            {isFull(card) ? "Read your approach" : "Read approach"}
          </Link>
        ) : (
          <Link
            href={`/practice/${card.problemSlug}#explain`}
            className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all"
          >
            Add approach
          </Link>
        )}

        {onCompareAvailable && (
          <Link
            href={`/practice/${card.problemSlug}/compare`}
            className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all flex items-center gap-1.5"
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
          className="ml-auto px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
          title="Copy share link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-verified" /> : <Link2 className="w-3.5 h-3.5" />}
          <span>{copied ? "Link copied" : "Share"}</span>
        </button>
      </div>

      {/* Challenge picker. Squad members only — no global user search (§61). */}
      {squadMembers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-hairline">
          <span className="text-[11px] text-text-tertiary">Challenge</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-surface-overlay border border-hairline rounded-full px-3 py-1.5 text-[11px] text-text-primary cursor-pointer"
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
            className="px-3 py-1.5 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-[11px] font-bold transition-all cursor-pointer"
          >
            Send challenge
          </button>
        </div>
      )}
    </div>
  );
}
