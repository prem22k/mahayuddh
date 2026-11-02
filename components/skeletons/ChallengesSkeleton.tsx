import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine, SkeletonTabs } from "./parts";

/** The hero slot above the tabs, shaped like the "No open challenges" card. */
export function ChallengeHeroSkeleton() {
  return (
    <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden>
      <div className="min-w-0 flex-1">
        <SkeletonLine className="h-[26px]" bar="h-4" width="w-56 max-w-full" />
        <SkeletonLine className="mt-1 h-6" bar="h-3.5" width="w-48 max-w-full" />
      </div>
      <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
    </div>
  );
}

/** Challenge rows (ChallengeRow) while the inbox loads. */
export function ChallengeListSkeleton() {
  return (
    <div className="space-y-3 md:space-y-2" aria-hidden>
      <Repeat count={4}>
        {(i) => (
          <div key={i} className="rounded-lg border border-hairline bg-surface p-3.5 md:px-5 md:py-3">
            <div className="md:flex md:min-h-10 md:items-center md:gap-5">
              <div className="flex items-center justify-between gap-2 md:w-48 md:shrink-0">
                <SkeletonLine className="h-4 md:h-5" bar="h-2.5" width="w-32" />
                <Skeleton className="h-5 w-16 rounded-xs md:hidden" />
              </div>
              <div className="mt-2 min-w-0 md:mt-0 md:flex-1">
                <SkeletonLine className="h-6" bar="h-3.5" width={i % 2 ? "w-1/2" : "w-2/3"} />
                <SkeletonLine className="mt-1 h-4 md:mt-0.5" bar="h-2.5" width="w-32" />
              </div>
              <Skeleton className="mt-3 h-10 w-full rounded-md md:mt-0 md:w-24 md:shrink-0" />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** The whole /challenges route. */
export function ChallengesSkeleton() {
  return (
    <div className="space-y-8 md:space-y-10">
      <LoadingStatus label="Loading challenges" />
      <div className="flex items-start justify-between gap-4" aria-hidden>
        <div className="min-w-0 flex-1">
          <SkeletonLine className="h-9" bar="h-7" width="w-48" />
          <SkeletonLine className="mt-1 h-10 sm:h-5 md:h-6" bar="h-3.5" width="w-60 max-w-full sm:w-80" />
        </div>
        <Skeleton className="h-11 w-36 shrink-0 rounded-md md:h-10" />
      </div>
      <ChallengeHeroSkeleton />
      <div className="space-y-4">
        <SkeletonTabs count={4} />
        <ChallengeListSkeleton />
      </div>
    </div>
  );
}
