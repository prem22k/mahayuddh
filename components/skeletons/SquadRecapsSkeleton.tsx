import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * Weekly recaps list (/squad/[id]/recaps) while it loads. Shared by the
 * route's loading.tsx and the page's own loading branch. Draws the common
 * case: back link, heading + write button, the latest edition card, and a
 * short archive.
 */
export function SquadRecapsSkeleton() {
  return (
    <div className="w-full space-y-8">
      <LoadingStatus label="Loading recaps" />
      <div className="space-y-4" aria-hidden>
        <div className="flex min-h-[44px] items-center gap-1.5 md:min-h-0">
          <Skeleton className="h-3.5 w-3.5 rounded-xs" />
          <SkeletonLine className="h-5" bar="h-3" width="w-24" />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SkeletonLine className="h-[29px] md:h-9" bar="h-6 md:h-7" width="w-48 md:w-56" />
            <SkeletonLine className="mt-1 h-5 md:h-6" bar="h-3 md:h-3.5" width="w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-md sm:w-[228px]" />
        </div>
      </div>

      {/* Latest edition. */}
      <div className="space-y-2" aria-hidden>
        <div className="flex items-center justify-between gap-3 px-1">
          <SkeletonLine className="h-6" bar="h-2.5" width="w-28" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-24" />
        </div>
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-44 rounded-full" />
              <Skeleton className="h-6 w-[72px] rounded-xs" />
            </div>
            <SkeletonLine className="hidden h-4 sm:flex" bar="h-2.5" width="w-28" />
          </div>
          <div>
            <SkeletonLine className="h-[25px] md:h-[30px]" bar="h-4 md:h-5" width="w-full" />
            <SkeletonLine className="h-[25px] md:h-[30px]" bar="h-4 md:h-5" width="w-1/2" />
          </div>
          <div className="hidden grid-cols-4 gap-2 sm:grid">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="flex flex-col rounded-md border border-hairline bg-well p-3">
                  <SkeletonLine className="h-6" bar="h-2" width="w-16" />
                  <SkeletonLine className="mt-0.5 h-8" bar="h-5" width="w-10" />
                </div>
              )}
            </Repeat>
          </div>
          <div className="rounded-md border border-hairline bg-well p-2.5 sm:hidden">
            <SkeletonLine className="h-[18px]" bar="h-2" width="w-full" />
            <SkeletonLine className="h-[18px]" bar="h-2" width="w-2/3" />
          </div>
          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-11 flex-1 rounded-md sm:w-[132px] sm:flex-none md:h-9" />
              <Skeleton className="h-11 w-24 shrink-0 rounded-md md:h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Past recaps. */}
      <div className="w-full max-w-reading space-y-4" aria-hidden>
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-6" bar="h-3.5" width="w-24" />
            <Skeleton className="h-5 w-20 rounded-xs" />
          </div>
          <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
        </div>
        <div className="space-y-2">
          <Repeat count={3}>
            {(i) => (
              <div
                key={i}
                className="flex min-h-[56px] items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-4 py-3 md:py-2"
              >
                <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
                  <div className="flex items-center gap-2 md:w-32 md:shrink-0">
                    <SkeletonLine className="h-5" bar="h-3" width="w-24" />
                    <Skeleton className="h-5 w-16 rounded-xs md:hidden" />
                  </div>
                  <span className="hidden h-4 w-px shrink-0 bg-hairline md:block" />
                  <SkeletonLine className="mt-0.5 h-5 flex-1 md:mt-0" bar="h-2.5" width={i === 1 ? "w-1/2" : "w-2/3"} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <SkeletonLine className="hidden h-4 sm:flex" bar="h-2.5" width="w-14" />
                  <Skeleton className="h-[18px] w-[18px] rounded-xs" />
                </div>
              </div>
            )}
          </Repeat>
        </div>
      </div>
    </div>
  );
}
