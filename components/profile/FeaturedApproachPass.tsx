import Link from "next/link";
import { ArrowRight, Award, Check, CircleCheck, Copy } from "lucide-react";
import { Pass, PassField } from "@/components/pass/Pass";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { formatDuration, titleFromSlug } from "@/lib/format";
import { stampDate } from "@/components/proof/stamp";
import type { Approach } from "@/types/database";
import { copiesOf, type ProblemMeta, type SolveProof } from "./portfolio";

/**
 * The portfolio's featured Pass (Stitch "Featured proof pass").
 *
 * Features the latest public approach — the thing this person chose to
 * publish — with the author's own solve of that problem, exactly as /a/[id]
 * shows it: the emerald seal only when a LeetCode-synced solve exists, a plain
 * "Self-reported" stub otherwise, and no time at all when none was recorded.
 */
export function FeaturedApproachPass({
  approach,
  meta,
  proof,
  handle,
}: {
  approach: Approach;
  meta: ProblemMeta | null;
  proof: SolveProof | null;
  handle: string;
}) {
  const title = meta?.title ?? titleFromSlug(approach.problem_slug);
  const time = formatDuration(proof?.seconds);
  const copies = copiesOf(approach);
  const published = stampDate(approach.created_at);

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
          Featured approach
        </span>
        {proof?.verified && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-verified">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-verified" />
            Verified solve
          </span>
        )}
      </div>
      <Pass
        className="[&>.pass-body]:p-5 md:min-h-[220px] md:[&>.pass-body]:p-6"
        stubClassName="justify-between p-4 md:p-5 max-md:flex-row max-md:items-center"
        body={
          <div className="flex h-full flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {meta?.difficulty && <DifficultyBadgeNew difficulty={meta.difficulty} size="sm" />}
                {approach.pattern && <PatternChip label={approach.pattern} className="h-5 px-2" />}
                {meta?.questionId && (
                  <span className="font-mono text-xs text-text-tertiary tnum">No. {meta.questionId}</span>
                )}
              </div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-text-primary md:text-xl">
                {title}
              </h2>
            </div>

            {proof && (
              <div>
                {time && (
                  <p className="font-mono text-3xl font-medium leading-none tracking-[-0.02em] text-text-primary tnum md:text-4xl">
                    {time}
                  </p>
                )}
                {proof.verified ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-verified">
                    <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                    {time ? "Fastest verified solve" : "Verified solve"}
                  </p>
                ) : (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Award className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                    {time ? "Fastest self-reported solve" : "Self-reported solve"}
                  </p>
                )}
              </div>
            )}

            <p className="line-clamp-2 text-sm italic leading-6 text-text-secondary">
              “{approach.core_idea.trim()}”
            </p>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-hairline pt-2.5 text-xs text-text-tertiary">
              <Link
                href={`/a/${approach.id}`}
                className="inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap font-medium text-text-primary underline-offset-4 hover:underline md:min-h-0"
              >
                Read approach
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
              {copies > 0 && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-text-secondary tnum">
                  <Copy className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                  copied {copies} {copies === 1 ? "time" : "times"}
                </span>
              )}
            </div>
          </div>
        }
        stub={
          <>
            <div className="flex min-w-0 flex-col gap-2">
              <PassField label="Author">@{handle}</PassField>
              {published && <PassField label="Published">{published}</PassField>}
              {meta?.questionId && <PassField label="Index">NO. {meta.questionId}</PassField>}
            </div>
            <div className="flex shrink-0 flex-col items-center md:pt-2">
              {proof?.verified ? (
                <span
                  role="img"
                  aria-label="Author's solve verified against LeetCode"
                  className="seal-bloom flex h-12 w-12 animate-stamp flex-col items-center justify-center rounded-full border border-verified/50 bg-verified-tint"
                >
                  <Check className="h-4 w-4 text-verified" strokeWidth={2.5} aria-hidden />
                  <span className="mt-0.5 font-mono text-[7px] font-semibold uppercase leading-none tracking-[0.02em] text-verified">
                    Verified
                  </span>
                </span>
              ) : (
                <span className="pass-serial rounded-sm border border-hairline-strong px-2 py-1">
                  {proof ? "Self-reported" : "Approach"}
                </span>
              )}
            </div>
          </>
        }
      />
    </div>
  );
}
