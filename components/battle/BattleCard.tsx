"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Swords, Check, Link2, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
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

/** Quiet bordered action: the page's one gold button lives elsewhere. */
const actionCls =
  "inline-flex h-11 items-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-3 text-xs font-medium leading-4 text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay md:h-9";

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
      <div className="rounded-lg border border-hairline bg-surface p-4 md:p-5" aria-hidden>
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-3 h-6 w-48" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/30 bg-error-tint p-4">
        <p className="text-sm leading-6 text-error">{error ?? "Card unavailable."}</p>
        <button
          onClick={load}
          className="inline-flex h-11 items-center rounded-md border border-error/30 bg-error/10 px-3 text-xs font-medium text-error transition-colors hover:bg-error/20 md:h-9"
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
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-lg border border-hairline bg-surface p-4 md:p-5">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-edge-highlight" aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
            Battle card
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
            {card.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {card.difficulty && <DifficultyBadgeNew difficulty={card.difficulty} size="sm" />}
            {card.pattern && <PatternChip label={card.pattern} />}
            {card.isPersonalRecord && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full border border-primary/40 bg-primary-tint px-2 text-xs font-semibold leading-4 text-primary">
                <Trophy className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                Personal best
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {failed ? (
            <>
              <div className="font-mono text-xl font-medium leading-7 text-error">Failed</div>
              <div className="mt-0.5 text-xs font-medium leading-4 text-text-tertiary">Revenge available</div>
            </>
          ) : (
            <>
              <div className="type-mono-lg text-text-primary">{solvedLabel ?? "—"}</div>
              <div className="mt-0.5 text-xs font-medium leading-4 text-text-tertiary">
                {prevLabel ? (
                  <>
                    Previous best{" "}
                    <span className="font-mono text-text-secondary tnum">{prevLabel}</span>
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline pt-3 text-xs font-medium leading-4 text-text-tertiary">
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
        <div className="rounded-md border border-hairline bg-well p-3">
          <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
            Your approach
          </div>
          <p className="text-sm leading-6 text-text-secondary">{card.approachExcerpt}</p>
        </div>
      )}

      {/* ── Actions. Every one wired (Principle 9). ── */}
      <div className="flex flex-wrap items-center gap-2">
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
          className={actionCls}
        >
          <Swords className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          <span>{failed ? "Take revenge" : "Revisit"}</span>
        </button>

        <button
          onClick={async () => {
            if (challenging) return;
            await openChallenge();
          }}
          className={actionCls}
        >
          Challenge someone
        </button>

        {hasApproach && approachId ? (
          <Link href={`/approach/${approachId}`} className={actionCls}>
            {isFull(card) ? "Read your approach" : "Read approach"}
          </Link>
        ) : (
          <Link href={`/practice/${card.problemSlug}#explain`} className={actionCls}>
            Add approach
          </Link>
        )}

        {onCompareAvailable && (
          <Link href={`/practice/${card.problemSlug}/compare`} className={actionCls}>
            <Users className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
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
          className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium leading-4 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-9"
          title="Copy share link"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} />
          ) : (
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          <span>{copied ? "Link copied" : "Share"}</span>
        </button>
      </div>

      {/* Challenge picker. Squad members only — no global user search (§61). */}
      {squadMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
          <span className="text-xs font-medium leading-4 text-text-tertiary">Challenge</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Squad member to challenge"
            className="h-11 rounded-md border border-hairline bg-well px-2.5 text-xs text-text-primary md:h-9"
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
            className={cn(actionCls, "border-primary/30 text-primary")}
          >
            Send challenge
          </button>
        </div>
      )}
    </div>
  );
}
