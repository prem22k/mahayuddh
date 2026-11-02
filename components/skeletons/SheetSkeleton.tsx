import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

const LABELS = ["w-24", "w-32", "w-20", "w-28", "w-36"];

/**
 * /sheets/[slug] while the roadmap loads: heading with the progress card, the
 * category matrix, the toolbar, then the first grouped problem sections.
 */
export function SheetSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <LoadingStatus label="Loading roadmap" />
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6" aria-hidden>
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-2.5 h-5 w-32 rounded-xs" />
          <SkeletonLine className="h-9" bar="h-7" width="w-56 max-w-full" />
          <SkeletonLine className="mt-1 h-5 md:h-6" bar="h-3.5" width="w-96 max-w-full" />
        </div>
        <div className="w-full shrink-0 rounded-lg border border-hairline bg-surface p-3.5 md:w-80 md:p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <SkeletonLine className="h-7" bar="h-6" width="w-24" />
            <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
          </div>
          <Skeleton className="mb-2.5 h-2 w-full rounded-full" />
          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2 md:border-0 md:pt-0">
            <Repeat count={3}>{(i) => <SkeletonLine key={i} className="h-4" bar="h-2.5" width="w-16" />}</Repeat>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-surface p-3.5 md:p-6" aria-hidden>
        <div className="mb-3.5 flex items-start justify-between gap-4 md:mb-6 md:items-center md:border-b md:border-hairline md:pb-4">
          <div className="min-w-0">
            <SkeletonLine className="h-6 md:h-[26px]" bar="h-4" width="w-36" />
            <SkeletonLine className="mt-0.5 h-4" bar="h-2.5" width="w-56 max-w-full" />
          </div>
          <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
        </div>
        <div className="flex flex-col gap-2.5 md:gap-3">
          <Repeat count={8}>
            {(i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] md:items-center md:gap-4 md:py-1"
              >
                <div className="flex min-h-[44px] items-center justify-between gap-2 md:min-h-9">
                  <SkeletonLine className="h-4 md:h-5" bar="h-2.5 md:h-3" width={LABELS[i % LABELS.length]} />
                  <SkeletonLine className="h-4" bar="h-2.5" width="w-8" />
                </div>
                <Skeleton className="h-5 w-full rounded-xs md:h-6" />
              </div>
            )}
          </Repeat>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4" aria-hidden>
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
          <Skeleton className="h-11 w-full rounded-md md:h-9 md:w-[280px]" />
          <Skeleton className="h-11 w-64 rounded-md md:h-8" />
        </div>
        <Skeleton className="h-11 w-32 rounded-md md:h-9" />
      </div>

      <div className="flex flex-col gap-3 md:gap-4" aria-hidden>
        <Repeat count={2}>
          {(g) => (
            <div key={g} className="rounded-lg border border-hairline bg-surface">
              <div className="flex min-h-[56px] items-center justify-between gap-2 rounded-t-lg border-b border-hairline bg-surface-raised/40 px-3 py-1.5 md:min-h-[64px] md:px-5 md:py-2.5">
                <div className="flex items-center gap-2 md:gap-3">
                  <Skeleton className="h-5 w-5 shrink-0 rounded-xs" />
                  <SkeletonLine className="h-5 md:h-6" bar="h-3.5" width={g ? "w-28" : "w-40"} />
                </div>
                <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
              </div>
              <div className="divide-y divide-hairline">
                <Repeat count={4}>
                  {(i) => (
                    <div key={i} className="flex min-h-[56px] items-center gap-2.5 px-3 py-1.5 md:gap-3.5 md:px-5 md:py-2">
                      <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                      <SkeletonLine className="h-4 w-12 shrink-0 md:w-16" bar="h-2.5" />
                      <SkeletonLine className="h-6 flex-1" bar="h-3.5" width={i % 2 ? "w-2/5" : "w-3/5"} />
                      <Skeleton className="h-6 w-16 shrink-0 rounded-xs" />
                    </div>
                  )}
                </Repeat>
              </div>
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}
