import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/** A rail card on the problem page (squad on this problem, open challenges). */
function RailCard({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4">
      <SkeletonLine className="h-6" bar="h-3.5" width="w-36" />
      <Repeat count={rows}>
        {(i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-5" width={i % 2 ? "w-20" : "w-28"} />
              <SkeletonLine className="h-4" bar="h-2.5" width="w-16" />
            </div>
            <SkeletonLine className="h-5 shrink-0" width="w-10" />
          </div>
        )}
      </Repeat>
    </div>
  );
}

/**
 * /practice/[slug] while the problem loads: the header (crumb, title, chips,
 * status, actions), the latest-result card and tabs, and the rail.
 */
export function ProblemSkeleton() {
  return (
    <div className="select-none">
      <LoadingStatus label="Loading problem" />
      <div
        className="flex flex-col gap-3 border-b border-hairline pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 lg:gap-y-3.5"
        aria-hidden
      >
        <SkeletonLine className="order-1 min-h-[44px] md:h-4 md:min-h-0 lg:col-span-2" bar="h-2.5" width="w-48" />
        <SkeletonLine
          className="order-2 h-[30px] md:h-9 lg:col-start-1 lg:row-start-2 lg:self-center"
          bar="h-5 md:h-7"
          width="w-2/3"
        />
        <div className="order-3 flex flex-wrap items-center gap-2 md:gap-3 lg:col-span-2 lg:row-start-3 lg:pt-1">
          <Skeleton className="hidden h-6 w-20 rounded-xs md:block" />
          <Skeleton className="h-6 w-16 rounded-xs" />
          <Skeleton className="h-6 w-24 rounded-xs" />
          <div className="flex w-full items-center gap-2 pt-1 md:w-auto md:pt-0">
            <SkeletonLine className="h-4" bar="h-2.5" width="w-28" />
          </div>
        </div>
        <div className="order-4 flex items-center gap-2 lg:col-start-2 lg:row-start-2 lg:self-center">
          <Skeleton className="h-11 flex-1 rounded-md md:h-10 md:w-36 md:flex-none" />
          <Skeleton className="h-11 w-28 rounded-md md:h-10 md:w-40" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-md md:h-10 md:w-10" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-md md:h-10 md:w-10" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12" aria-hidden>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2 md:border-0 md:pb-0">
              <SkeletonLine className="h-5" width="w-32" />
              <Skeleton className="h-6 w-20 rounded-xs" />
            </div>
            <SkeletonLine className="h-10 md:h-12" bar="h-8 md:h-10" width="w-40" />
            <SkeletonLine className="h-5" width="w-2/3" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-10 w-36 rounded-md" />
              <Skeleton className="h-10 w-28 rounded-md" />
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="-mx-4 flex items-center gap-4 border-b border-hairline px-4 md:mx-0 md:gap-6 md:px-0">
              <Repeat count={4}>
                {(i) => (
                  <div key={i} className="flex h-11 shrink-0 items-center">
                    <Skeleton className={`h-3.5 rounded-xs ${["w-24", "w-28", "w-24", "w-28"][i]}`} />
                  </div>
                )}
              </Repeat>
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6 pt-1 lg:col-span-4 lg:pt-0">
          <RailCard rows={3} />
          <RailCard rows={1} />
        </div>
      </div>
    </div>
  );
}
