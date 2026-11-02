import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonHeading, SkeletonLine } from "./parts";

/** StuckBoard while requests load: tabs, the ladder strip, the queue and the rail. */
export function StuckBoardSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-hidden>
      <div className="flex gap-6 border-b border-hairline">
        <Repeat count={2}>
          {(i) => (
            <div key={i} className="flex min-h-[44px] items-center gap-2 pb-2.5 pt-1 md:min-h-0">
              <Skeleton className={`h-3.5 rounded-xs ${i ? "w-24" : "w-20"}`} />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
          )}
        </Repeat>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3.5 md:gap-2.5 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center justify-between gap-4">
          <SkeletonLine className="h-4" bar="h-2.5" width="w-28" />
          <SkeletonLine className="hidden h-4 md:flex" bar="h-2.5" width="w-48" />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
          <Repeat count={4}>{(i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />}</Repeat>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8 lg:gap-6">
          <Repeat count={3}>
            {(i) => (
              <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <SkeletonLine className="h-6" bar="h-3.5" width={i % 2 ? "w-1/2" : "w-2/3"} />
                    <SkeletonLine className="h-4" bar="h-2.5" width="w-40" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 shrink-0 rounded-xs" />
              </div>
            )}
          </Repeat>
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-4">
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4">
            <SkeletonLine className="h-5" width="w-32" />
            <Repeat count={3}>{(i) => <SkeletonLine key={i} className="h-4" bar="h-2.5" width={i === 2 ? "w-3/4" : "w-full"} />}</Repeat>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The whole /stuck route: breadcrumb heading plus the board. */
export function StuckSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <LoadingStatus label="Loading requests" />
      <SkeletonHeading crumb="w-40" title="w-56" subtitle="w-72 max-w-full" />
      <StuckBoardSkeleton />
    </div>
  );
}
