import Link from "next/link";
import { Award, Check } from "lucide-react";
import { Pass, PassField } from "@/components/pass/Pass";
import { DifficultyBadgeNew, PatternChip, SelfReportedBadge, VerifiedBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatDuration } from "@/lib/format";
import { profileHref } from "@/lib/profiles/username";
import { cn } from "@/lib/utils";
import type { BattleOutcome } from "@/types/database";
import { gapLabel, stampDate, stampTime } from "./stamp";

/**
 * The Verified Proof card (DESIGN.md "The four Passes" #2, Stitch "Shared
 * proof link"). Landscape body + perforated stub on desktop; on a phone the
 * shared .pass stacks the stub under a horizontal tear line.
 *
 * Renders only what the battle row and its owner's history prove: the real
 * duration, the real date, and LeetCode evidence or its absence. An unsolved
 * battle says so instead of borrowing a solve's framing. No rank, no hash, no
 * squad name — the public projection does not have them, by design.
 */

export const OUTCOME_LABEL: Record<BattleOutcome, string> = {
  solved: "Solved",
  failed: "Not solved",
  abandoned: "Abandoned",
  in_progress: "In progress",
};

export interface ProofPassProps {
  title: string;
  difficulty: string | null;
  pattern: string | null;
  /** LeetCode frontend number, from the catalog. */
  questionId: string | null;
  outcome: BattleOutcome;
  verified: boolean;
  /** This solve's duration; null when unsolved or untimed. */
  solvedSec: number | null;
  /** Raw clock time on an unsolved battle, when one was recorded. */
  spentSec: number | null;
  previousBestSec: number | null;
  isPersonalRecord: boolean;
  ownerUsername: string | null;
  ownerAvatar: string | null;
  /** When the battle ended (or started, while it runs). */
  at: string;
}

export function ProofPass(p: ProofPassProps) {
  const solved = p.outcome === "solved";
  const time = formatDuration(p.solvedSec);
  const prev = formatDuration(p.previousBestSec);
  const date = stampDate(p.at);
  const clock = stampTime(p.at);
  const kicker = solved
    ? `Proof of solve · ${p.verified ? "LeetCode sync" : "Self-reported"}`
    : "Battle record";

  const hero = solved ? (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        {time ? (
          <span className="font-mono text-[44px] font-medium leading-none tracking-[-0.02em] text-text-primary tnum md:text-[56px]">
            {time}
          </span>
        ) : (
          <span className="font-display text-[36px] font-semibold leading-none tracking-[-0.02em] text-text-primary md:text-[44px]">
            Solved
          </span>
        )}
        {p.isPersonalRecord && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-hairline-strong bg-surface-raised px-2.5 text-xs font-medium leading-4 text-text-primary">
            <Award className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} aria-hidden />
            Personal best
          </span>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 font-mono text-[13px] leading-5 text-text-secondary tnum md:text-sm">
        {!time ? (
          <span>No timer on this solve</span>
        ) : prev && p.isPersonalRecord && p.previousBestSec != null && p.solvedSec != null ? (
          <>
            <span className="text-text-tertiary line-through">{prev}</span>
            <span aria-hidden>→</span>
            <span className="text-text-primary">{time}</span>
            <span aria-hidden className="text-text-tertiary">
              ·
            </span>
            <span className={p.verified ? "text-verified" : undefined}>
              {gapLabel(p.previousBestSec - p.solvedSec)} faster
            </span>
          </>
        ) : prev ? (
          <span>
            Previous best <span className="text-text-primary">{prev}</span>
          </span>
        ) : (
          <span>First timed solve</span>
        )}
      </p>
    </>
  ) : (
    <>
      <p className="font-display text-[32px] font-semibold leading-none tracking-[-0.02em] text-text-secondary md:text-[40px]">
        {OUTCOME_LABEL[p.outcome]}
      </p>
      {formatDuration(p.spentSec) && (
        <p className="mt-2 font-mono text-[13px] leading-5 text-text-tertiary tnum md:text-sm">
          <span className="text-text-secondary">{formatDuration(p.spentSec)}</span> on the clock
        </p>
      )}
    </>
  );

  const body = (
    <div className="flex h-full flex-col justify-between gap-5 md:gap-6">
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3 font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-text-tertiary md:mb-3 md:text-xs">
          <span>{kicker}</span>
          {date && <span className="shrink-0 tnum">{date}</span>}
        </div>
        <h1 className="mb-3 font-display text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-text-primary md:mb-4 md:text-[28px]">
          {p.title}
        </h1>
        {(p.difficulty || p.pattern || p.questionId) && (
          <div className="mb-5 flex flex-wrap items-center gap-2 md:mb-7 md:gap-2.5">
            {p.difficulty && <DifficultyBadgeNew difficulty={p.difficulty} />}
            {p.pattern && <PatternChip label={p.pattern} />}
            {p.questionId && (
              <span className="ml-auto font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum md:ml-0">
                No. {p.questionId}
              </span>
            )}
          </div>
        )}
        {hero}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3 md:pt-6">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <Avatar
            name={p.ownerUsername ?? "Mahayuddh"}
            src={p.ownerAvatar}
            className="border border-hairline md:h-10 md:w-10 md:text-sm"
          />
          {p.ownerUsername ? (
            <Link
              href={profileHref(p.ownerUsername)}
              className="truncate text-sm font-medium text-text-primary underline-offset-4 hover:underline md:font-semibold"
            >
              @{p.ownerUsername}
            </Link>
          ) : (
            <span className="truncate text-sm text-text-secondary">A Mahayuddh developer</span>
          )}
        </div>
        {solved && (p.verified ? <VerifiedBadge /> : <SelfReportedBadge />)}
      </div>
    </div>
  );

  const stub = (
    <>
      <div className="flex min-w-0 flex-col gap-2.5 md:gap-4">
        <PassField label="Solver">{p.ownerUsername ? `@${p.ownerUsername}` : "—"}</PassField>
        {date && (
          <PassField label="Timestamp">
            {date}
            {clock ? ` · ${clock} UTC` : ""}
          </PassField>
        )}
        {p.questionId && <PassField label="LeetCode no.">NO. {p.questionId}</PassField>}
      </div>
      <div className="flex shrink-0 flex-col items-center max-md:items-start md:pt-4">
        {solved && p.verified ? (
          <span
            role="img"
            aria-label="Verified against an accepted LeetCode submission"
            className="seal-bloom flex h-16 w-16 animate-stamp items-center justify-center rounded-full border-2 border-verified/80 bg-verified-tint md:h-24 md:w-24"
          >
            <span className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full border border-dashed border-verified/50 md:h-20 md:w-20">
              <Check className="h-5 w-5 text-verified md:h-7 md:w-7" strokeWidth={2.5} aria-hidden />
              <span className="mt-0.5 font-mono text-[8px] font-bold leading-none tracking-[0.12em] text-verified md:text-[10px]">
                VERIFIED
              </span>
            </span>
          </span>
        ) : (
          // DESIGN.md: a self-reported solve gets no seal; the stub says so plainly.
          <span className="pass-serial rounded-sm border border-hairline-strong px-2 py-1">
            {solved ? "Self-reported" : OUTCOME_LABEL[p.outcome]}
          </span>
        )}
      </div>
    </>
  );

  return (
    <Pass
      className={cn("w-full shadow-overlay", "[&>.pass-body]:p-5 md:[&>.pass-body]:p-9")}
      stubClassName={cn(
        "justify-between gap-6 md:basis-[244px] md:p-8 max-md:gap-4 max-md:px-5 max-md:py-4",
        // Phone: fields beside the seal; a plain text mark goes under the fields
        // so it never squeezes the timestamp.
        solved && p.verified ? "max-md:flex-row max-md:items-center" : "max-md:items-start"
      )}
      body={body}
      stub={stub}
    />
  );
}
