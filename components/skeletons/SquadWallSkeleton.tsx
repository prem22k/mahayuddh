import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * Squad wall (/squad/[id]/wall) while the milestones load. Shared by the
 * route's loading.tsx and the page's own loading branch. Draws the common
 * case: back link, heading + count chip, the latest-milestone card, then one
 * month of the timeline and the desktop "next moment" prompt.
 */
export function SquadWallSkeleton() {
  return (
    <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-10">
      <LoadingStatus label="Loading the wall" />
      <div className="space-y-2 md:space-y-3" aria-hidden>
        <div className="flex min-h-[44px] items-center gap-1.5 md:min-h-0">
          <Skeleton className="h-3.5 w-3.5 rounded-xs" />
          <SkeletonLine className="h-5" bar="h-3" width="w-24" />
        </div>
        <div className="flex flex-col gap-1 md:gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <SkeletonLine className="h-8 md:h-9" bar="h-6 md:h-7" width="w-52 md:w-64" />
            <Skeleton className="h-[30px] w-24 shrink-0 rounded-xs md:h-[26px] md:w-28" />
          </div>
          <SkeletonLine className="h-5" bar="h-2.5 md:h-3" width="w-64 md:w-80 max-w-full" />
        </div>
      </div>

      {/* Latest milestone card. */}
      <div className="rounded-xl border border-hairline bg-surface p-4 md:p-6" aria-hidden>
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-[30px] w-36 rounded-xs" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <div className="flex items-start gap-3 md:gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-md md:h-12 md:w-12 md:rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-1.5">
              <SkeletonLine className="h-7 md:h-8" bar="h-4 md:h-5" width="w-3/4" />
              <SkeletonLine className="h-6 md:hidden" bar="h-2.5" width="w-20" />
              <div className="pt-1 md:pt-0">
                <SkeletonLine className="h-5 md:h-6" bar="h-2.5 md:h-3" width="w-full" />
                <SkeletonLine className="h-5 md:h-6" bar="h-2.5 md:h-3" width="w-2/5" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5 md:pt-4">
            <SkeletonLine className="h-6" bar="h-2.5" width="w-24" />
            <SkeletonLine className="h-6" bar="h-2.5" width="w-16" />
          </div>
        </div>
      </div>

      {/* One month of the timeline. */}
      <div className="flex flex-col gap-3 md:gap-6" aria-hidden>
        <div className="flex items-center gap-2 md:gap-3">
          <SkeletonLine className="h-5 md:h-7" bar="h-3 md:h-3.5" width="w-20" />
          <div className="h-px flex-1 bg-hairline" />
          <SkeletonLine className="h-6" bar="h-2" width="w-16" />
        </div>
        <div className="relative ml-1.5 flex flex-col gap-3.5 border-l border-hairline pl-4 md:ml-2 md:gap-6 md:pl-6">
          <Repeat count={2}>
            {(i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-md border border-hairline bg-surface p-3 md:gap-2 md:rounded-lg md:p-4">
                <div className="flex items-start justify-between gap-2 md:gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
                    <SkeletonLine className="h-6 md:h-5" bar="h-3" width={i === 0 ? "w-48" : "w-40"} />
                    <SkeletonLine className="h-5" bar="h-2.5" width="w-2/3" />
                  </div>
                  <SkeletonLine className="h-6 w-10 shrink-0 md:w-12" bar="h-2" />
                </div>
                <div className="hidden items-center gap-2 border-t border-hairline pt-2 md:flex">
                  <Skeleton className="h-7 w-24 rounded-xs" />
                  <SkeletonLine className="h-6" bar="h-2.5" width="w-14" />
                </div>
              </div>
            )}
          </Repeat>
        </div>
      </div>

      <div
        className="hidden items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-6 md:flex"
        aria-hidden
      >
        <div className="flex flex-1 flex-col gap-1">
          <SkeletonLine className="h-5" bar="h-3" width="w-72" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-80" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0 rounded-sm" />
      </div>
    </div>
  );
}
