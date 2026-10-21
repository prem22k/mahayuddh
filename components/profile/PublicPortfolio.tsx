import { Check, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactFrame, VisitorCta } from "@/components/recap/ArtifactChrome";
import { Avatar } from "@/components/ui/Avatar";
import { PatternChip } from "@/components/ui/Badge";
import { ShareRow } from "@/components/ui/ShareRow";
import { PostKit } from "@/components/ui/PostKit";
import { formatDuration } from "@/lib/format";
import { oftenTeaches, reputationDimensions, type TeacherStats } from "@/lib/reputation";
import type { JourneyBody } from "@/lib/journey";
import type { Approach, Primer } from "@/types/database";
import { FollowButton } from "./FollowButton";
import { OwnerNotice } from "./OwnerNotice";
import { FeaturedApproachPass } from "./FeaturedApproachPass";
import { ProofDimensions } from "./ProofDimensions";
import { PublicProfileBody } from "./PublicProfileBody";
import type { ProblemMeta, SolveProof } from "./portfolio";

/**
 * Public portfolio layout (Step 22; Stitch "Public profile", desktop + mobile).
 *
 * Identity beside a featured Pass, the five §22 dimensions, public teaching
 * tabs, and a quiet visitor close. No scores, no radar, no badge walls. The
 * page owns every read and the ?next= links; this only lays them out.
 */
export interface PublicPortfolioProps {
  handle: string;
  displayName: string;
  userId: string;
  avatarUrl: string | null;
  /** "Oct 2026", from profiles.created_at. */
  memberSince: string | null;
  stats: TeacherStats | null;
  journey: JourneyBody | null;
  approaches: Approach[];
  primers: Primer[];
  problems: Record<string, ProblemMeta>;
  proofs: Record<string, SolveProof>;
  artifactPath: string;
  signInHref: string;
  signupHref: string;
  shareText: string;
}

/** Bold the "N things" runs in the journey summary, the way the frame sets its numbers. */
function emphasize(summary: string) {
  return summary.split(/(\d+\s+[A-Za-z]+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-medium text-text-primary">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function PublicPortfolio(p: PublicPortfolioProps) {
  const dimensions = p.stats ? reputationDimensions(p.stats) : [];
  const teaches = oftenTeaches(p.stats?.frequent_patterns ?? []);
  const featured = p.approaches[0] ?? null;
  const hasVerified = (p.stats?.verified_solves ?? 0) > 0;

  // Grid rows for the identity block. Explicit rows so an absent line never
  // leaves an empty track (and a doubled gap) behind. Literal class names for
  // Tailwind's scanner.
  const ROW = { 3: "row-start-3", 4: "row-start-4" } as const;
  const MD_ROW = { 2: "md:row-start-2", 3: "md:row-start-3", 4: "md:row-start-4" } as const;
  const hasTeaches = teaches.length > 0;
  const journeyRow = hasTeaches ? 4 : 3;
  const journeyMdRow = hasTeaches ? 3 : 2;
  const actionsMdRow = (2 + (hasTeaches ? 1 : 0) + (p.journey ? 1 : 0)) as 2 | 3 | 4;

  return (
    <ArtifactFrame signInHref={p.signInHref} crumb="Public profile" className="max-w-content">
      <div className="space-y-10 md:space-y-12">
        <OwnerNotice userId={p.userId} />

        <section className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Identity. One grid so the phone layout (avatar | actions, then the
              name) and the desktop one (avatar | name, actions last) share one
              h1 instead of rendering it twice. */}
          <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3.5 md:gap-x-5 md:gap-y-5 lg:col-span-7">
            <div className="relative col-start-1 row-start-1 shrink-0">
              <Avatar
                name={p.displayName}
                src={p.avatarUrl}
                size="xl"
                className="h-16 w-16 border border-hairline-strong font-display text-xl font-semibold text-text-primary md:h-24 md:w-24 md:text-3xl"
              />
              {hasVerified && (
                <span
                  title="Has LeetCode-verified solves"
                  className="absolute -bottom-0.5 -right-0.5 rounded-full border border-hairline bg-surface p-0.5 md:-bottom-1 md:-right-1 md:p-1"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-verified-tint text-verified md:h-5 md:w-5">
                    <Check className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="sr-only">Has LeetCode-verified solves</span>
                </span>
              )}
            </div>

            <div className="col-span-2 row-start-2 min-w-0 space-y-1.5 md:col-span-1 md:col-start-2 md:row-start-1 md:self-center">
              <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-text-primary md:text-3xl">
                {p.displayName}
              </h1>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
                <span className="font-mono font-medium text-text-primary">@{p.handle}</span>
                {p.memberSince && (
                  <>
                    <span aria-hidden className="text-text-tertiary">
                      ·
                    </span>
                    <span className="text-xs text-text-tertiary">Member since {p.memberSince}</span>
                  </>
                )}
              </p>
            </div>

            <div
              className={cn(
                "col-start-2 row-start-1 flex items-center gap-2 justify-self-end pt-1 md:col-span-2 md:col-start-1 md:gap-3 md:justify-self-start",
                MD_ROW[actionsMdRow]
              )}
            >
              <FollowButton userId={p.userId} username={p.handle} signInHref={p.signInHref} />
              <ShareRow
                path={p.artifactPath}
                artifact={{ kind: "journey", id: p.handle }}
                text={p.shareText}
                label="Share"
                compact
                className="h-9 border-hairline bg-transparent px-3 text-xs hover:bg-surface-raised md:h-10 md:px-4 md:text-sm"
              />
            </div>

            {hasTeaches && (
              <div className="col-span-2 row-start-3 flex flex-wrap items-center gap-2 text-sm md:row-start-2">
                <span className="text-text-tertiary">Often teaches:</span>
                {teaches.map((t) => (
                  <PatternChip key={t} label={t} href={`/patterns/${encodeURIComponent(t)}`} />
                ))}
              </div>
            )}

            {p.journey && (
              <p
                className={cn(
                  "col-span-2 max-w-[620px] text-sm leading-6 text-text-secondary md:text-[15px]",
                  ROW[journeyRow],
                  MD_ROW[journeyMdRow]
                )}
              >
                {emphasize(p.journey.summary)}
                {!/\bdays?\b/.test(p.journey.summary) && (
                  <span className="text-text-tertiary"> Last {p.journey.window.days} days.</span>
                )}
              </p>
            )}
          </div>

          <div className="w-full lg:col-span-5">
            {featured ? (
              <FeaturedApproachPass
                approach={featured}
                meta={p.problems[featured.problem_slug.toLowerCase()] ?? null}
                proof={p.proofs[featured.problem_slug.toLowerCase()] ?? null}
                handle={p.handle}
              />
            ) : (
              <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
                <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-raised text-text-tertiary">
                  <Award className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </span>
                <p className="font-display text-base font-medium text-text-primary">Nothing featured yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-text-tertiary">
                  When @{p.handle} publishes an approach, it shows up here with their solve.
                </p>
              </div>
            )}
          </div>
        </section>

        {p.stats && dimensions.length > 0 && <ProofDimensions dimensions={dimensions} stats={p.stats} />}

        <PublicProfileBody
          approaches={p.approaches}
          primers={p.primers}
          problems={p.problems}
          proofs={p.proofs}
          totalApproaches={p.stats?.approaches}
        />

        <footer className="space-y-8 border-t border-hairline pt-8">
          {p.journey?.medianSolveSec != null && (
            <p className="text-center font-mono text-xs leading-5 text-text-tertiary">
              Median solve time:{" "}
              <span className="font-medium text-text-secondary tnum">
                {formatDuration(p.journey.medianSolveSec)}
              </span>{" "}
              over the last {p.journey.window.days} days.
            </p>
          )}
          <div className="flex justify-center">
            <PostKit
              imageHref={`/u/${encodeURIComponent(p.handle)}/opengraph-image`}
              path={p.artifactPath}
              artifact={{ kind: "journey", id: p.handle }}
              text={p.shareText}
            />
          </div>
          <div className="mx-auto max-w-2xl">
            <VisitorCta
              href={p.signupHref}
              body="One problem a day, timed and verified. Your squad sees who solved it and how they thought about it."
            />
          </div>
        </footer>
      </div>
    </ArtifactFrame>
  );
}
