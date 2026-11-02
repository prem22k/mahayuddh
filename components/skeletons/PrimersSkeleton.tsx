import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonHeading, SkeletonLine } from "./parts";

/** Section heading in primer pages: text-lg on a 26px line. */
function SectionHeading({ width }: { width: string }) {
  return <SkeletonLine className="h-[26px]" bar="h-4" width={width} />;
}

/** PrimerList while primers load: the recommended card, then the list. */
export function PrimerListSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-xs" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-16" />
        </div>
        <div className="flex flex-col gap-1.5">
          <SkeletonLine className="h-[29px]" bar="h-5" width="w-2/3" />
          <SkeletonLine className="h-12 md:h-10" bar="h-3.5" width="w-full" />
        </div>
        <div className="flex flex-col gap-4 md:mt-1 md:flex-row md:items-center md:justify-between md:border-t md:border-hairline md:pt-4">
          <SkeletonLine className="h-5" width="w-48" />
          <Skeleton className="h-12 w-full rounded-md md:w-36" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading width="w-28" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
        </div>
        <div className="flex flex-col gap-2">
          <Repeat count={5}>
            {(i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-3 md:h-14 md:flex-row md:items-center md:gap-3 md:rounded-md md:bg-surface/60 md:px-4 md:py-0"
              >
                <Skeleton className="h-6 w-24 shrink-0 rounded-xs" />
                <SkeletonLine className="h-5 md:flex-1" width={["w-1/2", "w-2/5", "w-3/5"][i % 3]} />
                <SkeletonLine className="h-4 md:w-20 md:shrink-0" bar="h-2.5" width="w-20" />
              </div>
            )}
          </Repeat>
        </div>
      </div>
    </div>
  );
}

/** The whole /primers route. */
export function PrimersSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <LoadingStatus label="Loading primers" />
      <SkeletonHeading title="w-36" subtitle="w-80 max-w-full" gap="gap-1.5" />
      <PrimerListSkeleton />
    </div>
  );
}

/**
 * /primers/[slug] while the primer loads: the reading column (breadcrumb,
 * jump chips on phones, header, the first sections) and the contents rail.
 */
export function PrimerSkeleton() {
  return (
    <div className="mx-auto max-w-[960px] lg:grid lg:grid-cols-[minmax(0,680px)_224px] lg:justify-center lg:gap-12">
      <LoadingStatus label="Loading primer" />
      <div className="flex max-w-reading flex-col gap-8 md:gap-10" aria-hidden>
        <div className="flex flex-col gap-3">
          <SkeletonLine className="min-h-[44px] md:min-h-0" width="w-40" />
          <div className="-mx-4 flex items-center gap-2 overflow-hidden border-y border-hairline px-4 py-1 lg:hidden">
            <SkeletonLine className="h-4 w-9 shrink-0" bar="h-2.5" />
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="flex min-h-[44px] shrink-0 items-center">
                  <Skeleton className="h-8 w-28 rounded-full" />
                </div>
              )}
            </Repeat>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-hairline pb-8">
          <Skeleton className="h-6 w-24 rounded-xs" />
          <SkeletonLine className="h-[35px] md:h-[46px]" bar="h-7 md:h-9" width="w-4/5" />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SkeletonLine className="h-4" bar="h-2.5" width="w-56" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-44 rounded-md md:h-9" />
              <Skeleton className="h-11 w-20 rounded-md md:h-9" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading width="w-44" />
          <div className="mt-1 flex flex-col gap-2.5">
            <Repeat count={3}>
              {(i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-hairline bg-surface p-3.5">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-xs" />
                  <div className="flex-1 pt-0.5">
                    <SkeletonLine className="h-6" bar="h-3.5" width="w-full" />
                    <SkeletonLine className="h-6" bar="h-3.5" width={i === 1 ? "w-1/2" : "w-3/4"} />
                  </div>
                </div>
              )}
            </Repeat>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SectionHeading width="w-36" />
          <div className="flex flex-col gap-2">
            <SkeletonLine className="h-6" bar="h-3.5" width="w-full" />
            <SkeletonLine className="h-6" bar="h-3.5" width="w-11/12" />
            <SkeletonLine className="h-6" bar="h-3.5" width="w-2/3" />
          </div>
        </div>
      </div>

      <div className="hidden lg:block" aria-hidden>
        <div className="flex flex-col gap-3">
          <SkeletonLine className="h-4" bar="h-2.5" width="w-24" />
          <div className="flex flex-col gap-2 border-l border-hairline pl-2">
            <Repeat count={6}>
              {(i) => <SkeletonLine key={i} className="h-7" bar="h-3" width={["w-32", "w-24", "w-20", "w-28"][i % 4]} />}
            </Repeat>
          </div>
        </div>
      </div>
    </div>
  );
}
