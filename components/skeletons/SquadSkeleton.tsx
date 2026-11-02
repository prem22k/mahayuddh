import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * Squad hub (/squad) while the squad loads. Shared by app/squad/loading.tsx
 * and the page's own loading branch, so navigation shows one skeleton. It
 * draws the common case (a squad with members); phone order matches the
 * page: heading, streak pass, goal, members, then the rail.
 */

/** SquadStreakPass: run + who owes today, the 7-day grid, then the stub. */
function StreakPassSkeleton() {
  return (
    <div className="pass" aria-hidden>
      <div className="pass-body">
        <div className="flex flex-col gap-5 md:gap-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg md:h-12 md:w-12" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="mb-1 h-6" bar="h-2.5" width="w-24" />
              <Skeleton className="h-[30px] w-28 rounded-xs md:h-12 md:w-40" />
              <SkeletonLine className="mt-1 h-5" width="w-56 max-w-full" />
            </div>
          </div>
          <div className="rounded-lg border border-hairline bg-well p-3 md:p-4">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-hairline pb-2 md:mb-3 md:pb-3">
              <SkeletonLine className="h-6" bar="h-2.5" width="w-16" />
              <SkeletonLine className="h-6 w-[170px] shrink-0 md:w-[210px]" bar="h-2.5" />
            </div>
            <div className="flex flex-col gap-2 md:gap-2.5">
              <Repeat count={3}>
                {(i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Skeleton className="hidden h-6 w-6 shrink-0 rounded-full md:block" />
                      <SkeletonLine className="h-4" bar="h-2.5" width={i === 0 ? "w-16" : "w-12"} />
                    </div>
                    <div className="grid w-[170px] shrink-0 grid-cols-7 items-center justify-items-center gap-2 md:w-[210px] md:gap-3">
                      <Repeat count={7}>
                        {(d) => <Skeleton key={d} className="h-2 w-2 rounded-full md:h-2.5 md:w-2.5" />}
                      </Repeat>
                    </div>
                  </div>
                )}
              </Repeat>
            </div>
            <div className="mt-3 hidden items-center justify-between border-t border-hairline pt-2 md:flex">
              <SkeletonLine className="h-6" bar="h-2.5" width="w-40" />
              <SkeletonLine className="h-6" bar="h-2.5" width="w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center">
            <Skeleton className="h-11 w-full rounded-md md:h-12 md:w-56" />
          </div>
        </div>
      </div>
      <div className="pass-stub justify-between gap-4">
        <div className="flex flex-col gap-4">
          <SkeletonLine className="h-6" bar="h-2.5" width="w-20" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:py-2">
            <Repeat count={3}>
              {(i) => (
                <div key={i} className="flex flex-col">
                  <SkeletonLine className="h-4" bar="h-2" width="w-12" />
                  <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-hairline pt-3 md:pt-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <SkeletonLine className="h-4" bar="h-2" width="w-20" />
          </div>
          <Skeleton className="h-4 w-8 rounded-xs" />
        </div>
      </div>
    </div>
  );
}

/** The goal card, in its "goal set" shape (progress bar and contributors line). */
function GoalCardSkeleton() {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 md:p-6" aria-hidden>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <SkeletonLine className="h-6" bar="h-2.5" width="w-28" />
          <SkeletonLine className="h-6 md:h-7" bar="h-4" width="w-2/3" />
        </div>
        <Skeleton className="h-8 w-20 shrink-0 rounded-sm" />
      </div>
      <div className="mt-3 md:mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-3 md:mb-2">
          <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-24" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full md:h-2" />
      </div>
      <div className="mt-2.5 md:mt-4 md:border-t md:border-hairline md:pt-3">
        <SkeletonLine className="h-4" bar="h-2.5" width="w-48" />
      </div>
    </div>
  );
}

/** "Squad Members (n)" and the divided member list (56px rows). */
function MembersSkeleton() {
  return (
    <div className="flex flex-col gap-2 md:gap-3" aria-hidden>
      <div className="flex items-center justify-between px-1">
        <SkeletonLine className="h-6 md:h-7" bar="h-3.5" width="w-32" />
        <SkeletonLine className="h-6" bar="h-2.5" width="w-16" />
      </div>
      <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
        <Repeat count={3}>
          {(i) => (
            <div
              key={i}
              className="flex min-h-[56px] items-center justify-between gap-3 px-3 py-2.5 md:px-5 md:py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5 md:gap-3.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full md:h-8 md:w-8" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <SkeletonLine className="h-5" bar="h-3" width={i === 0 ? "w-28" : "w-24"} />
                  <SkeletonLine className="h-4" bar="h-2" width="w-44 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-7 w-[74px] shrink-0 rounded-xs md:h-8 md:rounded-sm" />
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}

/** InviteLink while the referral link is minted: copy + share row, then link activity. */
export function InviteLinkSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      <div className="flex items-stretch gap-2">
        <Skeleton className="h-11 flex-1 rounded-md md:h-9" />
        <Skeleton className="h-11 w-20 shrink-0 rounded-md md:h-9" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2">
        <SkeletonLine className="h-6" bar="h-2.5" width="w-20" />
        <SkeletonLine className="h-6" bar="h-2.5" width="w-28" />
      </div>
    </div>
  );
}

/** The rail: invite card, season card, squad links, weekly rhythm. */
function RailSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:col-span-4" aria-hidden>
      <div className="rounded-lg border border-hairline bg-surface p-4 md:p-5">
        <SkeletonLine className="h-5 md:h-6" bar="h-3.5" width="w-32" />
        <div className="mb-3 mt-1 md:mb-4 md:mt-2">
          <SkeletonLine className="h-5" bar="h-2.5" width="w-full" />
          <SkeletonLine className="h-5" bar="h-2.5" width="w-1/2" />
        </div>
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xs border border-hairline bg-well p-2.5 md:mb-3 md:rounded-md md:p-3">
          <div className="flex min-w-0 flex-col">
            <SkeletonLine className="hidden h-6 md:flex" bar="h-2" width="w-16" />
            <SkeletonLine className="h-4 md:h-6" bar="h-3" width="w-24" />
          </div>
          <Skeleton className="h-4 w-8 shrink-0 rounded-xs md:h-8 md:w-8 md:rounded-sm" />
        </div>
        <InviteLinkSkeleton />
      </div>

      <div className="rounded-lg border border-hairline bg-surface p-4 md:p-5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <SkeletonLine className="h-6" bar="h-2.5" width="w-24" />
        </div>
        <SkeletonLine className="h-5 md:h-6" bar="h-3.5" width="w-36" />
        <SkeletonLine className="mt-1 h-5" bar="h-2.5" width="w-3/4" />
        <Skeleton className="mt-3 h-11 w-full rounded-sm md:h-8" />
      </div>

      <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
        <Repeat count={2}>
          {(i) => (
            <div key={i} className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-4 w-4 rounded-xs" />
                <SkeletonLine className="h-5 md:h-4" bar="h-2.5" width={i === 0 ? "w-20" : "w-24"} />
              </div>
              <Skeleton className="h-4 w-4 rounded-xs" />
            </div>
          )}
        </Repeat>
      </div>

      <div className="rounded-lg border border-hairline bg-well p-4">
        <SkeletonLine className="mb-2 h-6" bar="h-2" width="w-32" />
        <div className="flex flex-col md:gap-1">
          <Repeat count={7}>
            {(i) => (
              <div key={i} className="flex min-h-[44px] items-center gap-2 md:min-h-[24px]">
                <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
                <SkeletonLine className="h-4" bar="h-2.5" width={i % 2 === 0 ? "w-36" : "w-28"} />
              </div>
            )}
          </Repeat>
        </div>
      </div>
    </div>
  );
}

export function SquadSkeleton() {
  return (
    <div className="space-y-6 select-none md:space-y-8">
      <LoadingStatus label="Loading squad" />
      {/* Heading row: name + facts, actions on the right (desktop). */}
      <div
        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 md:border-b md:border-hairline md:pb-6"
        aria-hidden
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-h-[44px] items-center">
              <SkeletonLine className="h-8 md:h-9" bar="h-6 md:h-7" width="w-44 md:w-56" />
            </div>
            <Skeleton className="h-[30px] w-[78px] shrink-0 rounded-xs md:hidden" />
          </div>
          <div className="flex items-center justify-between gap-3 md:mt-1">
            <SkeletonLine className="h-5" bar="h-2.5 md:h-3" width="w-32 md:w-72" />
            <div className="flex min-h-[44px] shrink-0 items-center md:hidden">
              <Skeleton className="h-3 w-32 rounded-xs" />
            </div>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <Skeleton className="h-10 w-[150px] rounded-sm" />
          <Skeleton className="h-10 w-[124px] rounded-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8 lg:gap-8">
          <StreakPassSkeleton />
          <GoalCardSkeleton />
          <MembersSkeleton />
        </div>
        <RailSkeleton />
      </div>
    </div>
  );
}
