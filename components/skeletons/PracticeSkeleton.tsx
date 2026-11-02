import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonHeading, SkeletonLine } from "./parts";

/** Section heading in the hub: text-lg on a 26px line. */
function SectionHeading({ width }: { width: string }) {
  return <SkeletonLine className="h-[26px]" bar="h-4" width={width} />;
}

/**
 * The Practice hub body (PracticeHub) while reviews, weak patterns, primers
 * and sheet progress load: due-for-review focal column, the rail, then the
 * full-width sheets section.
 */
export function PracticeHubSkeleton() {
  return (
    <div className="space-y-6 md:space-y-12" aria-hidden>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="min-w-0 space-y-3 lg:col-span-8">
          <SectionHeading width="w-36" />
          <div className="space-y-3">
            {/* Featured review */}
            <div className="rounded-lg border border-hairline bg-surface-raised p-4 md:bg-surface md:p-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <SkeletonLine className="h-[29px]" bar="h-5" width="w-2/3" />
                <Skeleton className="hidden h-6 w-16 rounded-xs md:block" />
              </div>
              <SkeletonLine className="h-5" width="w-1/2" />
              <SkeletonLine className="h-5" width="w-1/3" />
              <div className="mt-4 flex gap-3">
                <Skeleton className="h-11 w-40 rounded-md" />
                <Skeleton className="h-11 w-20 rounded-md" />
              </div>
            </div>
            <div className="flex flex-col gap-3 md:gap-2">
              <Repeat count={2}>
                {(i) => (
                  <div
                    key={i}
                    className="flex min-h-14 items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-3"
                  >
                    <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                    <SkeletonLine className="h-6 flex-1" bar="h-3.5" width={i === 0 ? "w-1/2" : "w-2/5"} />
                    <Skeleton className="h-8 w-16 shrink-0 rounded-xs" />
                  </div>
                )}
              </Repeat>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4 lg:gap-8">
          <div className="space-y-3">
            <div>
              <SectionHeading width="w-32" />
              <SkeletonLine className="mt-0.5 h-4" bar="h-2.5" width="w-52" />
            </div>
            <div className="space-y-2 md:space-y-2.5">
              <Repeat count={3}>
                {(i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3 md:rounded-md md:p-3.5"
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <Skeleton className="h-6 w-28 rounded-xs" />
                      <SkeletonLine className="h-4" bar="h-2.5" width="w-36" />
                    </div>
                    <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-xs" />
                  </div>
                )}
              </Repeat>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
        <SectionHeading width="w-44" />
        <div className="space-y-2.5 md:space-y-3">
          <Repeat count={3}>
            {(i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-3.5 md:flex-row md:items-center md:gap-6 md:rounded-md md:p-4"
              >
                <SkeletonLine className="h-5 md:w-48 md:shrink-0" width="w-28" />
                <div className="flex flex-1 items-center gap-4">
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <SkeletonLine className="h-4 w-16 shrink-0" bar="h-2.5" />
                </div>
                <Skeleton className="hidden h-8 w-20 shrink-0 rounded-xs md:block" />
              </div>
            )}
          </Repeat>
        </div>
      </div>
    </div>
  );
}

/** The whole /practice route: heading plus the hub body. */
export function PracticeSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <LoadingStatus label="Loading practice" />
      <SkeletonHeading title="w-36" titleLine="h-[31px] md:h-9" subtitle="w-56" />
      <PracticeHubSkeleton />
    </div>
  );
}
