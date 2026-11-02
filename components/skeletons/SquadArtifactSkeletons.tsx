"use client";

import { Skeleton } from "@/components/ui/States";
import { ArtifactFrame, MemberOnly } from "@/components/recap/ArtifactChrome";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * The public squad artifacts (weekly recap, season result) while the server
 * reads them. Both pages are server components, so these are what their
 * loading.tsx shows during navigation. They sit inside the real ArtifactFrame,
 * so the visitor gutters and brand bar (signed out) or the bare shell column
 * (signed in) are already in place when the content streams in.
 */

/** Crumb in the visitor brand bar: the real one is a week or season name. */
const crumb = <Skeleton className="inline-block h-2.5 w-28 rounded-xs align-middle" />;

/** SectionLabel: mono caption on a 16px line. */
function LabelSkeleton({ width = "w-36" }: { width?: string }) {
  return <SkeletonLine className="h-4" bar="h-2.5" width={width} />;
}

/** ShareRow expanded (3-up 56px tiles on a phone, 40px row on desktop) + PostKit row. */
function ShareBlockSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center">
      <Repeat count={tiles}>
        {(i) => <Skeleton key={i} className="h-14 rounded-md md:h-10 md:w-[92px]" />}
      </Repeat>
    </div>
  );
}

/** /squad/[id]/recaps/[recapId] */
export function RecapDetailSkeleton() {
  return (
    <ArtifactFrame crumb={crumb} signInHref="/login" className="max-w-reading space-y-10">
      <LoadingStatus label="Loading recap" />

      <div className="space-y-3" aria-hidden>
        <MemberOnly>
          <div className="mb-3 flex min-h-[44px] items-center gap-1.5 md:min-h-0">
            <Skeleton className="h-3.5 w-3.5 rounded-xs" />
            <SkeletonLine className="h-5" bar="h-3" width="w-24" />
          </div>
        </MemberOnly>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SkeletonLine className="h-6" bar="h-3" width="w-56 max-w-full" />
          <Skeleton className="h-6 w-28 shrink-0 rounded-xs" />
        </div>
        <div>
          <SkeletonLine className="h-[31px] md:h-11" bar="h-6 md:h-8" width="w-full" />
          <SkeletonLine className="h-[31px] md:h-11" bar="h-6 md:h-8" width="w-2/3" />
        </div>
        <div>
          <SkeletonLine className="h-6 md:h-7" bar="h-3.5" width="w-full" />
          <SkeletonLine className="h-6 md:h-7" bar="h-3.5" width="w-5/6 md:w-1/2" />
          <SkeletonLine className="h-6 md:hidden" bar="h-3.5" width="w-1/3" />
        </div>
      </div>

      {/* The week in numbers. */}
      <div className="space-y-2" aria-hidden>
        <LabelSkeleton />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-0 sm:divide-x sm:divide-hairline sm:rounded-xl sm:border sm:border-hairline sm:bg-surface sm:py-5">
          <Repeat count={5}>
            {(i) => (
              <div
                key={i}
                className={
                  i === 0
                    ? "col-span-2 flex flex-col rounded-lg border border-hairline bg-surface p-3.5 sm:col-span-1 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-4 sm:py-1"
                    : "flex flex-col rounded-lg border border-hairline bg-surface p-3.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-4 sm:py-1"
                }
              >
                <Skeleton className="h-7 w-10 rounded-xs lg:my-1 lg:h-8" />
                <SkeletonLine className="mt-1.5 h-4" bar="h-2.5" width="w-16" />
              </div>
            )}
          </Repeat>
        </div>
      </div>

      {/* What happened. */}
      <div className="space-y-3" aria-hidden>
        <SkeletonLine className="h-[26px]" bar="h-3.5" width="w-36" />
        <div className="space-y-2 md:space-y-0 md:divide-y md:divide-hairline md:overflow-hidden md:rounded-xl md:border md:border-hairline md:bg-surface">
          <Repeat count={3}>
            {(i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-3.5 md:gap-3.5 md:rounded-none md:border-0 md:bg-transparent md:p-5"
              >
                <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1">
                  <SkeletonLine className="h-5" bar="h-3" width={i === 1 ? "w-1/2" : "w-3/4"} />
                  <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
                </div>
              </div>
            )}
          </Repeat>
        </div>
      </div>

      {/* Share this recap. */}
      <div className="space-y-2" aria-hidden>
        <LabelSkeleton width="w-32" />
        <div className="space-y-4 rounded-xl border border-hairline bg-surface p-4 md:p-5">
          <ShareBlockSkeleton />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-11 w-36 rounded-md" />
              <Skeleton className="h-11 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </ArtifactFrame>
  );
}

/** /squad/[id]/seasons/[seasonId] */
export function SeasonResultSkeleton() {
  return (
    <ArtifactFrame crumb={crumb} signInHref="/login" className="max-w-[720px] space-y-8">
      <LoadingStatus label="Loading season" />

      <div className="space-y-2" aria-hidden>
        <div className="flex items-center justify-between gap-3 md:hidden">
          <SkeletonLine className="h-4" bar="h-2.5" width="w-24" />
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <SkeletonLine className="h-9" bar="h-7" width="w-56 max-w-full" />
          <Skeleton className="mt-1.5 hidden h-6 w-20 shrink-0 rounded-full md:block" />
        </div>
        <SkeletonLine className="h-6" bar="h-3.5" width="w-64 max-w-full" />
        <div className="pt-1">
          <Skeleton className="h-8 w-72 max-w-full rounded-md md:h-5" />
        </div>
      </div>

      {/* Objective card. */}
      <div className="card space-y-5 md:p-7" aria-hidden>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Skeleton className="h-14 w-36 rounded-md" />
              <Skeleton className="h-7 w-32 rounded-xs" />
            </div>
            <SkeletonLine className="h-[26px]" bar="h-3.5" width="w-56 max-w-full" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Skeleton className="hidden h-[26px] w-28 rounded-xs md:block" />
            <SkeletonLine className="h-5" bar="h-3" width="w-12" />
          </div>
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <SkeletonLine className="h-4" bar="h-2.5" width="w-64 max-w-full" />
        <div className="border-t border-hairline pt-4">
          <SkeletonLine className="h-6" bar="h-3.5" width="w-full" />
          <SkeletonLine className="h-6" bar="h-3.5" width="w-1/2" />
        </div>
      </div>

      {/* The season in numbers. */}
      <div className="space-y-2.5" aria-hidden>
        <div className="flex items-center justify-between gap-3 md:hidden">
          <SkeletonLine className="h-[26px]" bar="h-3.5" width="w-44" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:flex md:gap-0 md:divide-x md:divide-hairline md:rounded-lg md:border md:border-hairline md:bg-surface md:px-4 md:py-3">
          <Repeat count={6}>
            {(i) => (
              <div
                key={i}
                className="rounded-lg border border-hairline bg-surface p-3 md:flex md:flex-1 md:flex-col md:items-center md:rounded-none md:border-0 md:bg-transparent md:px-2 md:py-0"
              >
                <SkeletonLine className="h-[31px] md:h-7" bar="h-5 md:h-4" width="w-10" />
                <SkeletonLine className="mt-1 h-4 md:mt-0.5" bar="h-2.5" width="w-24 md:w-14" />
              </div>
            )}
          </Repeat>
        </div>
      </div>

      {/* Who practised. */}
      <div className="space-y-3" aria-hidden>
        <div className="flex items-center justify-between gap-3">
          <SkeletonLine className="h-[26px]" bar="h-3.5" width="w-32" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-36" />
        </div>
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
          <Repeat count={3}>
            {(i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[12rem_minmax(0,1fr)_5rem] md:gap-x-6 md:py-4"
              >
                <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-full md:h-8 md:w-8" />
                  <SkeletonLine className="h-5" bar="h-3" width="w-24" />
                </div>
                <SkeletonLine className="h-5 md:order-3 md:justify-end" bar="h-3" width="w-16" />
                <Skeleton className="col-span-2 h-1.5 rounded-full md:order-2 md:col-span-1 md:h-2" />
              </div>
            )}
          </Repeat>
        </div>
      </div>

      {/* Back to squad + share. */}
      <div className="space-y-3 pt-1" aria-hidden>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <MemberOnly>
            <Skeleton className="h-11 w-full rounded-md md:h-10 md:w-36" />
          </MemberOnly>
          <div className="grid grid-cols-3 gap-2 md:ml-auto md:flex md:items-center">
            <Repeat count={3}>
              {(i) => <Skeleton key={i} className="h-14 rounded-md md:h-10 md:w-[92px]" />}
            </Repeat>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Skeleton className="h-11 w-36 rounded-md" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </div>
      </div>
    </ArtifactFrame>
  );
}
