import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/** One approach card in the comparison grid. */
function ApproachCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <SkeletonLine className="h-5" width="w-28" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
        </div>
        <Skeleton className="h-6 w-16 shrink-0 rounded-xs" />
      </div>
      <div className="space-y-1">
        <SkeletonLine className="h-6" bar="h-3.5" width="w-full" />
        <SkeletonLine className="h-6" bar="h-3.5" width="w-4/5" />
      </div>
      <Skeleton className="h-32 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

/**
 * /practice/[slug]/compare while approaches load: breadcrumb, header,
 * the "where they differ" card, then a technique group of two approaches.
 */
export function CompareSkeleton() {
  return (
    <div className="space-y-5 md:space-y-8">
      <LoadingStatus label="Loading approaches" />
      <SkeletonLine className="min-h-[44px] md:h-4 md:min-h-0" bar="h-2.5" width="w-56" />
      <div
        className="flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-end md:pb-6"
        aria-hidden
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-xs" />
            <Skeleton className="h-6 w-24 rounded-xs" />
          </div>
          <SkeletonLine className="h-[30px] md:h-10" bar="h-5 md:h-7" width="w-3/4" />
          <SkeletonLine className="mt-1 h-5" width="w-48" />
        </div>
        <Skeleton className="hidden h-8 w-36 shrink-0 rounded-sm md:block" />
      </div>
      <div className="space-y-5 md:space-y-8" aria-hidden>
        <div className="rounded-lg border border-hairline bg-surface p-4 md:p-5">
          <SkeletonLine className="mb-2.5 h-4 md:mb-3" bar="h-2.5" width="w-32" />
          <div className="space-y-2">
            <Repeat count={3}>
              {(i) => <SkeletonLine key={i} className="h-[18px] md:h-6" bar="h-3" width={["w-full", "w-5/6", "w-2/3"][i]} />}
            </Repeat>
          </div>
        </div>
        <div className="space-y-4">
          <SkeletonLine className="h-6" bar="h-3.5" width="w-40" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ApproachCardSkeleton />
            <ApproachCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
