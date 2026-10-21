import Link from "next/link";
import { ArrowRight, CircleCheck, ExternalLink, Info } from "lucide-react";
import { ArtifactFrame, VisitorOnly } from "@/components/recap/ArtifactChrome";
import { ShareRow } from "@/components/ui/ShareRow";
import { PostKit } from "@/components/ui/PostKit";
import type { BattleCardPublic } from "@/lib/battleCard";
import type { BattleOutcome } from "@/types/database";
import { ProofPass } from "./ProofPass";
import { TryProblemLink } from "./TryProblemLink";
import { plural } from "./stamp";

/**
 * Shared proof link body (Stitch "Shared proof link", desktop + mobile).
 *
 * The page owns the reads and the ?next= links; this lays out the public
 * projection. Signed out there is no app shell, so ArtifactFrame brings the
 * brand bar and gutters; signed in, the shell's <main> provides both.
 */
export interface ProofViewProps {
  battleId: string;
  card: BattleCardPublic;
  outcome: BattleOutcome;
  /** Raw battle duration, shown as clock time on an unsolved battle. */
  durationSec: number | null;
  /** ended_at, or started_at while the battle runs. */
  at: string;
  questionId: string | null;
  ownerAvatar: string | null;
  signInHref: string;
  signupHref: string;
  shareText: string;
}

export function ProofView({
  battleId,
  card,
  outcome,
  durationSec,
  at,
  questionId,
  ownerAvatar,
  signInHref,
  signupHref,
  shareText,
}: ProofViewProps) {
  const solved = outcome === "solved";
  const verified = solved && card.evidence === "leetcode";
  const who = card.ownerUsername ? `@${card.ownerUsername}` : "the solver";
  const artifactPath = `/b/${battleId}`;
  const { attempts, revisits, challengesSent, friendsCompleted } = card.stats;

  const evidence = !solved
    ? outcome === "in_progress"
      ? "This battle is still running."
      : "This battle ended without a solve."
    : verified
      ? "Verified against an accepted LeetCode submission."
      : `Logged by ${who} without a LeetCode match.`;

  return (
    <ArtifactFrame
      signInHref={signInHref}
      crumb={`Proof #${battleId.slice(0, 8)}`}
      className="max-w-content"
    >
      <div className="mx-auto flex w-full max-w-[780px] flex-col items-center md:pt-6">
        <ProofPass
          title={card.title}
          difficulty={card.difficulty}
          pattern={card.pattern}
          questionId={questionId}
          outcome={outcome}
          verified={verified}
          solvedSec={card.solvedSec}
          spentSec={solved ? null : durationSec}
          previousBestSec={card.previousBestSec}
          isPersonalRecord={card.isPersonalRecord}
          ownerUsername={card.ownerUsername}
          ownerAvatar={ownerAvatar}
          at={at}
        />

        <div className="mt-4 flex w-full flex-col gap-2.5 px-1 md:mt-6 md:flex-row md:items-center md:justify-between md:gap-4 md:px-2">
          <p className="font-mono text-xs leading-5 text-text-tertiary tnum">
            {plural(attempts, "attempt")} · {plural(revisits, "revisit")} · challenged {challengesSent}
            {friendsCompleted > 0 && (
              <span className="text-text-secondary">
                {" "}
                · answered {plural(friendsCompleted, "challenge")}
              </span>
            )}
          </p>
          <p className="flex items-start gap-2 text-xs leading-5 text-text-secondary max-md:rounded-lg max-md:border max-md:border-hairline max-md:bg-surface max-md:p-2.5 md:items-center md:text-right">
            {verified ? (
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified md:mt-0" strokeWidth={1.5} aria-hidden />
            ) : (
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary md:mt-0" strokeWidth={1.5} aria-hidden />
            )}
            <span>{evidence}</span>
          </p>
        </div>

        <div className="mt-5 flex w-full flex-col gap-2 sm:mt-8 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3">
          <TryProblemLink slug={card.problemSlug} signupHref={signupHref} className="h-12 w-full sm:h-11 sm:w-auto" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <a
              href={`https://leetcode.com/problems/${card.problemSlug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-3 text-xs font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] sm:gap-2 sm:px-5 sm:text-sm"
            >
              <span className="sm:hidden">See on LeetCode</span>
              <span className="hidden sm:inline">See it on LeetCode</span>
              <ExternalLink className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} aria-hidden />
            </a>
            <ShareRow
              path={artifactPath}
              artifact={{ kind: "battle", id: battleId }}
              text={shareText}
              label="Share proof"
              compact
              className="h-11 w-full border-hairline bg-transparent px-4 text-xs text-text-secondary hover:bg-surface-raised sm:w-auto sm:border-transparent sm:text-sm"
            />
          </div>
        </div>

        {card.sharedApproachId && (
          <Link
            href={`/a/${card.sharedApproachId}`}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-pattern underline-offset-4 hover:underline"
          >
            Read {card.ownerUsername ? `@${card.ownerUsername}'s` : "the"} approach
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </Link>
        )}

        <div className="mt-8 flex w-full justify-center border-t border-hairline pt-6">
          <PostKit
            imageHref={`/b/${battleId}/opengraph-image`}
            path={artifactPath}
            artifact={{ kind: "battle", id: battleId }}
            text={shareText}
          />
        </div>
      </div>

      <VisitorOnly>
        <footer className="mt-16 flex flex-col items-center justify-between gap-2 border-t border-hairline pt-6 text-xs leading-4 text-text-tertiary sm:flex-row">
          <p>
            <span className="font-display font-semibold text-text-secondary">Mahayuddh</span>
            {" · "}Practice DSA with your people
          </p>
          <Link
            href={signupHref}
            className="inline-flex min-h-[44px] items-center font-medium text-text-secondary underline decoration-hairline-strong underline-offset-4 transition-colors hover:text-text-primary sm:min-h-0"
          >
            Start your squad
          </Link>
        </footer>
      </VisitorOnly>
    </ArtifactFrame>
  );
}
