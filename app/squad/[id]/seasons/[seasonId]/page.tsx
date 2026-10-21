import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CircleCheck, CircleMinus, Flag, Hourglass, type LucideIcon } from "lucide-react";
import { safeNext } from "@/lib/safeNext";
import { getSeasonResult, type SeasonResult } from "@/lib/data/seasonResult";
import { profileHref } from "@/lib/profiles/username";
import { titleFromSlug } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShareRow } from "@/components/ui/ShareRow";
import { PostKit } from "@/components/ui/PostKit";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { Avatar } from "@/components/ui/Avatar";
import { PatternChip } from "@/components/ui/Badge";
import { ArtifactFrame, MemberOnly, VisitorCta } from "@/components/recap/ArtifactChrome";
import { SectionLabel, SpeedupChip, TimeDelta } from "@/components/recap/RecapBlocks";
import { WhoPractised } from "@/components/recap/WhoPractised";
import { daysInclusive, formatDay, formatRange, serialOf } from "@/components/recap/recapFormat";

export const dynamic = "force-dynamic";

/**
 * Public season result (§38).
 *
 * The fifth artifact Step 20 asked for and the only one never built. A season is
 * the one thing a squad finishes together, so it is the artifact whose whole
 * point is the group — and a completed season previously had nothing to share.
 *
 * The headline is generated the same way the recap's is: it states what
 * happened, including when a challenge loop never ran.
 */
async function load(squadId: string, seasonId: string) {
  return getSeasonResult(squadId, seasonId);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}): Promise<Metadata> {
  const { id, seasonId } = await params;
  const result = await load(id, seasonId);
  if (!result) return { robots: { index: false } };
  return {
    title: `${result.squadName} — ${result.name}`,
    description: result.headline,
    openGraph: {
      title: `${result.squadName} — ${result.name}`,
      description: result.headline,
    },
  };
}

const STATUS_LABEL: Record<SeasonResult["status"], string> = {
  complete: "Archived",
  active: "Active",
  upcoming: "Upcoming",
};

function StatusChip({ status, className }: { status: SeasonResult["status"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-raised px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active" ? "bg-text-secondary" : "bg-text-disabled"
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default async function SeasonResultPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const { id: squadId, seasonId } = await params;
  const result = await load(squadId, seasonId);
  if (!result) notFound();

  const path = `/squad/${squadId}/seasons/${seasonId}`;
  // Deep-continue (Wave D): the visitor CTA carries ?next=<artifact> through
  // safeNext so auth lands back on this season. "Back to squad" stays a member
  // nav to the auth-walled hub — a ?next= there would be dropped by the hub —
  // so the deep-continue lives on Start your squad. Login honors ?next=.
  const nextParam = encodeURIComponent(safeNext(path) ?? "/home");
  const shareText = `${result.squadName} — ${result.name}: ${result.headline}`;
  const artifact = { kind: "season" as const, id: seasonId, squadId };

  // Calendar arithmetic on the season's own dates: how long it runs, how much
  // of it has elapsed, and how much is left. No new measurements.
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = result.endsAt && result.endsAt.slice(0, 10) < today ? result.endsAt : today;
  const seasonDays = result.endsAt ? daysInclusive(result.startsAt, result.endsAt) : null;
  const elapsedDays = result.status === "upcoming" ? null : daysInclusive(result.startsAt, lastDay);
  const daysLeft =
    result.status === "active" && result.endsAt ? daysInclusive(today, result.endsAt) : null;
  const activeDaysOf = result.status === "complete" ? seasonDays : elapsedDays;

  const op = result.objectiveProgress;
  const pattern = op?.pattern ?? result.objectivePattern;
  const patternLabel = pattern ? pattern.charAt(0).toUpperCase() + pattern.slice(1) : null;
  const ratio = op ? op.done / op.target : 0;
  const pctBar = Math.max(2, Math.min(100, Math.round(ratio * 100)));
  const pctLabel = `${Math.round(ratio * 1000) / 10}%`;
  const met = op ? op.done >= op.target : false;
  const objectiveChip: { label: string; icon: LucideIcon } | null = !op
    ? null
    : met
      ? { label: "Objective met", icon: CircleCheck }
      : result.status === "complete"
        ? { label: "Objective missed", icon: CircleMinus }
        : result.status === "active"
          ? {
              label: daysLeft ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : "In progress",
              icon: Hourglass,
            }
          : { label: "Not started", icon: Hourglass };

  const stats: { short: string; long: string; value: number; of?: number | null }[] = [
    { short: "solves", long: "Total squad solves", value: result.solves },
    { short: "problems", long: "Unique problems", value: result.problems },
    { short: "challenges", long: "Challenges sent", value: result.challengesSent },
    { short: "beaten", long: "Beaten", value: result.challengesCompleted },
    { short: "approaches", long: "Approaches written", value: result.approachesWritten },
    { short: "active days", long: "Active squad days", value: result.activeDays, of: activeDaysOf },
  ];

  const range = formatRange(result.startsAt, result.endsAt, { year: true });
  const best = result.bestImprovement;
  const footerWhen =
    result.status === "complete" && result.endsAt
      ? `ended ${formatDay(result.endsAt, { year: true })}`
      : result.endsAt
        ? `runs to ${formatDay(result.endsAt, { year: true })}`
        : `started ${formatDay(result.startsAt, { year: true })}`;

  return (
    <ArtifactFrame
      crumb={result.name}
      signInHref={`/login?next=${nextParam}`}
      className="max-w-[720px] space-y-8"
    >
      <Suspense fallback={null}>
        <TrackVisit artifact={`season:${seasonId}`} />
      </Suspense>

      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
            Squad season
          </p>
          <StatusChip status={result.status} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="type-display-md text-text-primary">{result.name}</h1>
          <StatusChip status={result.status} className="mt-1.5 hidden md:inline-flex" />
        </div>
        <p className="text-[15px] leading-6 text-text-secondary">
          <span className="text-text-primary md:text-text-secondary">{result.squadName}</span>
          <span aria-hidden> · </span>
          <span className="tnum">{range}</span>
        </p>
        {result.objective && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <p className="inline-flex min-h-8 items-start gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm leading-5 md:border-0 md:bg-transparent md:p-0">
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary md:hidden" strokeWidth={1.5} aria-hidden />
              <span>
                <span className="text-text-secondary">Squad objective: </span>
                <span className="font-medium text-text-primary">{result.objective}</span>
              </span>
            </p>
            {patternLabel && <PatternChip label={patternLabel} />}
          </div>
        )}
      </header>

      {op && objectiveChip ? (
        <section className="card space-y-5 md:p-7" aria-label="Season objective">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="type-numeral-xl text-text-primary">
                  {op.done}
                  <span className="mx-1.5 text-3xl font-normal text-text-tertiary">/</span>
                  {op.target}
                </p>
                <span className="inline-flex h-7 items-center gap-1 rounded-xs border border-hairline-strong bg-surface-raised px-2.5 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-text-primary">
                  <objectiveChip.icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  {objectiveChip.label}
                </span>
              </div>
              <p className="text-lg font-medium leading-[26px] text-text-primary">
                {op.pattern && op.filtered ? `${op.pattern} solves` : "Solves"} toward the objective
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="hidden rounded-xs border border-hairline bg-well px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-secondary tnum md:inline-flex">
                Pass {serialOf(seasonId)}
              </span>
              <span className="font-mono text-sm font-medium text-text-primary tnum">{pctLabel}</span>
            </div>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-well"
            role="progressbar"
            aria-valuenow={Math.min(100, Math.round(ratio * 100))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Season objective progress: ${op.done} of ${op.target}`}
          >
            <div
              className="h-full rounded-full bg-text-primary transition-all duration-200"
              style={{ width: `${pctBar}%` }}
            />
          </div>
          <p className="text-xs leading-4 text-text-tertiary">
            {op.basis === "parsed"
              ? "Parsed from the objective text — set a measured target to track this exactly."
              : op.pattern && !op.filtered
                ? "Pattern filter couldn't be measured against the catalog — counting all solves."
                : op.filtered
                  ? `Counted from squad solves in this season${op.pattern ? ` matching ${op.pattern}` : ""}.`
                  : "Counted from squad solves in this season."}
          </p>
          <p className="border-t border-hairline pt-4 text-[15px] leading-6 text-text-secondary">
            {result.headline}
          </p>
        </section>
      ) : (
        <section className="card space-y-4 md:p-7">
          <p className="type-numeral-xl text-text-primary">
            {result.solves} <span className="text-text-secondary">solves</span>
          </p>
          <p className="border-t border-hairline pt-4 text-[15px] leading-6 text-text-secondary">
            {result.headline}
          </p>
        </section>
      )}

      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
            The season in numbers
          </h2>
          {seasonDays && (
            <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary tnum">
              {seasonDays}-day season
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:flex md:gap-0 md:divide-x md:divide-hairline md:rounded-lg md:border md:border-hairline md:bg-surface md:px-4 md:py-3">
          {stats.map((s) => (
            <div
              key={s.short}
              className="rounded-lg border border-hairline bg-surface p-3 md:flex md:flex-1 md:flex-col md:items-center md:rounded-none md:border-0 md:bg-transparent md:px-2 md:py-0"
            >
              <p className="flex items-baseline gap-1">
                <span className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary tnum md:font-mono md:text-xl md:font-medium md:leading-7 md:tracking-normal">
                  {s.value}
                </span>
                {s.of != null && (
                  <span className="font-mono text-xs text-text-tertiary tnum">/ {s.of}</span>
                )}
              </p>
              <p className="mt-1 text-xs font-medium text-text-secondary md:mt-0.5">
                <span className="md:hidden">{s.long}</span>
                <span className="hidden md:inline">{s.short}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {best && (
        <section className="space-y-2">
          <SectionLabel>Milestone highlight</SectionLabel>
          <div className="space-y-3 rounded-xl border border-hairline bg-surface p-3.5 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0 md:p-5">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <Avatar
                name={best.username}
                size="md"
                className="border border-hairline font-mono md:h-11 md:w-11 md:text-sm"
              />
              <div className="min-w-0">
                <Link
                  href={profileHref(best.username)}
                  className="block truncate text-sm font-semibold text-text-primary hover:underline"
                >
                  @{best.username}
                </Link>
                <p className="mt-0.5 truncate text-sm text-text-secondary md:text-[15px] md:text-text-primary">
                  {titleFromSlug(best.slug)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-well p-2.5 md:shrink-0 md:justify-end md:border-0 md:bg-transparent md:p-0">
              <TimeDelta fromSec={best.fromSec} toSec={best.toSec} size="md" />
              <SpeedupChip fromSec={best.fromSec} toSec={best.toSec} />
            </div>
          </div>
        </section>
      )}

      {result.members.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
              Who practised
            </h2>
            <span className="text-xs font-medium text-text-tertiary tnum">
              {result.members.length} {result.members.length === 1 ? "member" : "members"} logged solves
            </span>
          </div>
          <WhoPractised members={result.members} />
        </section>
      )}

      <div className="space-y-3 pt-1">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <MemberOnly>
            <Link
              href="/squad"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-hairline px-4 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-10 md:min-h-0"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Back to squad
            </Link>
          </MemberOnly>
          <ShareRow
            expanded
            targets={["x", "linkedin"]}
            path={path}
            artifact={artifact}
            text={shareText}
            className="md:ml-auto"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <PostKit
            imageHref={`${path}/opengraph-image`}
            path={path}
            artifact={artifact}
            text={shareText}
          />
          {/* The phone share sheet, where there is one. */}
          <div className="md:hidden">
            <ShareRow compact path={path} artifact={artifact} text={shareText} label="Share season" />
          </div>
        </div>
      </div>

      <VisitorCta
        href={`/login?mode=signup&next=${nextParam}`}
        body="Timed solves, verified proof, and seasons your squad finishes together."
      />

      <footer className="border-t border-hairline pt-6 text-center font-mono text-xs text-text-tertiary tnum">
        Mahayuddh · {result.name} · {footerWhen}
      </footer>
    </ArtifactFrame>
  );
}
