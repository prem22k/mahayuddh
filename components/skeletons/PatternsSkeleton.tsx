import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/** Heading block shared by the index and a hub: title + chip, then a 15/17px line. */
function PatternHeading({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-9" bar="h-7" width={title} />
        <Skeleton className="h-6 w-20 shrink-0 rounded-xs" />
      </div>
      <SkeletonLine className="h-6 md:h-7" bar="h-3.5 md:h-4" width="w-96 max-w-full" />
    </div>
  );
}

/** /patterns: heading, then the two-column list of topic rows. */
export function PatternsIndexSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <LoadingStatus label="Loading patterns" />
      <PatternHeading title="w-40" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3" aria-hidden>
        <Repeat count={10}>
          {(i) => (
            <div
              key={i}
              className="flex min-h-14 items-center gap-4 rounded-lg border border-hairline bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <SkeletonLine className="h-6" bar="h-3.5" width={["w-32", "w-40", "w-28", "w-36", "w-24"][i % 5]} />
                <SkeletonLine className="mt-0.5 h-4" bar="h-2.5" width="w-24" />
              </div>
              <Skeleton className="hidden h-1.5 w-20 shrink-0 rounded-full sm:block" />
              <Skeleton className="h-4 w-4 shrink-0 rounded-xs" />
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}

/** A rail card on a pattern hub (mistakes, squad approaches). */
function RailCard({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      <SkeletonLine className="h-6" bar="h-3.5" width="w-32" />
      <div className="flex flex-col gap-3">
        <Repeat count={rows}>
          {(i) => <Skeleton key={i} className="h-16 w-full rounded-md" />}
        </Repeat>
      </div>
    </div>
  );
}

/** /patterns/[topic]: breadcrumb, heading, learning path card and the rail. */
export function PatternHubSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <LoadingStatus label="Loading pattern" />
      <SkeletonLine className="min-h-[44px] md:min-h-0" width="w-56" />
      <PatternHeading title="w-56 max-w-full" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12" aria-hidden>
        <div className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface lg:col-span-8">
          <div className="flex items-center justify-between gap-3 p-3.5 md:gap-4 md:p-6">
            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <SkeletonLine className="h-6 md:h-[26px]" bar="h-3.5 md:h-4" width="w-48 max-w-full" />
                <SkeletonLine className="h-4" bar="h-2.5" width="w-36" />
              </div>
            </div>
            <Skeleton className="h-11 w-28 shrink-0 rounded-md md:h-9" />
          </div>
          <div className="divide-y divide-hairline border-t border-hairline">
            <Repeat count={5}>
              {(i) => (
                <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5 md:gap-4 md:px-6 md:py-2">
                  <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                  <SkeletonLine className="h-6 flex-1" bar="h-3.5" width={i % 2 ? "w-1/3" : "w-1/2"} />
                  <Skeleton className="h-6 w-16 shrink-0 rounded-xs" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <RailCard rows={2} />
          <RailCard rows={1} />
        </div>
      </div>
    </div>
  );
}
