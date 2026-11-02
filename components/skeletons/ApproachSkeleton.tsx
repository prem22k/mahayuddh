import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * /approach/[id] while the write-up loads, in the reading column: breadcrumb,
 * author header card, core idea well, the details table, then the action deck.
 */
export function ApproachSkeleton() {
  return (
    <div className="mx-auto flex max-w-reading flex-col gap-5 md:gap-6">
      <LoadingStatus label="Loading approach" />
      <SkeletonLine className="min-h-[44px] md:min-h-0" width="w-64 max-w-full" />

      <div className="rounded-xl border border-hairline bg-surface p-4 md:p-5" aria-hidden>
        <div className="flex items-center gap-3 border-b border-hairline pb-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full md:h-10 md:w-10" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-5" width="w-32" />
            <SkeletonLine className="mt-1 h-4" bar="h-2.5" width="w-44" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <SkeletonLine className="h-6 flex-1" bar="h-3.5" width="w-1/2" />
          <Skeleton className="h-6 w-16 shrink-0 rounded-xs" />
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-well p-4 md:p-6" aria-hidden>
        <SkeletonLine className="mb-3 h-4" bar="h-2.5" width="w-16" />
        <SkeletonLine className="h-7" bar="h-4" width="w-full" />
        <SkeletonLine className="h-7" bar="h-4" width="w-11/12" />
        <SkeletonLine className="h-7" bar="h-4" width="w-3/5" />
      </div>

      <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface" aria-hidden>
        <Repeat count={4}>
          {(i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <SkeletonLine className="h-5" width="w-20" />
              <SkeletonLine className="h-5" width={i % 2 ? "w-24" : "w-16"} />
            </div>
          )}
        </Repeat>
      </div>

      <div
        className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3 md:flex-row md:items-center md:justify-between md:gap-3 md:p-4"
        aria-hidden
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-10 w-full rounded-md md:h-9 md:w-36" />
          <Skeleton className="h-10 w-full rounded-md md:h-9 md:w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-md md:h-9 md:w-40" />
      </div>
    </div>
  );
}
