import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/utils";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * Quality gates (/validation). The page draws its header straight away and
 * reads the board after; ValidationBoardSkeleton is the page's first-read
 * branch, ValidationStatusSkeleton holds the status banner's slot, and
 * ValidationSkeleton is the whole route (loading.tsx, and while auth resolves).
 */

const card = "rounded-xl border border-hairline bg-surface";

/** One gate / review row: title + question on the left, verdict badge on the right. */
function GateRowSkeleton({ measured, note }: { measured?: boolean; note?: boolean }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SkeletonLine className="h-5" bar="h-3" width="w-40" />
          <SkeletonLine className="mt-0.5 h-5" bar="h-2.5" width="w-3/4" />
        </div>
        <div className="flex shrink-0 items-start gap-6">
          {measured && <SkeletonLine className="hidden h-5 pt-1 md:flex" bar="h-3" width="w-20" />}
          <Skeleton className="h-7 w-[68px] rounded-xs" />
        </div>
      </div>
      {measured && <SkeletonLine className="mt-2 h-5 md:hidden" bar="h-3" width="w-20" />}
      {note && <SkeletonLine className="mt-2 h-5" bar="h-2.5" width="w-2/3" />}
    </div>
  );
}

/** CardHeader of the observation / triage cards. */
function CardHeaderSkeleton({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
      <div className="min-w-0 flex-1">
        <SkeletonLine className="h-6" bar="h-3.5" width={title} />
        <SkeletonLine className="mt-0.5 h-5" bar="h-2.5" width="w-4/5" />
      </div>
      <Skeleton className="h-[26px] w-10 shrink-0 rounded-xs" />
    </div>
  );
}

/** The status banner's slot (one sentence in a bordered strip). */
export function ValidationStatusSkeleton() {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-3" aria-hidden>
      <SkeletonLine className="h-6" bar="h-3" width="w-3/4" />
    </div>
  );
}

/** §58 gates, §76 review, and the observation / triage cards. */
export function ValidationBoardSkeleton() {
  return (
    <>
      <LoadingStatus label="Reading the gates" />
      <div className="max-w-[760px] space-y-3" aria-hidden>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SkeletonLine className="h-6" bar="h-2.5" width="w-24" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-36" />
        </div>
        <div className={cn(card, "divide-y divide-hairline overflow-hidden")}>
          <Repeat count={5}>{(i) => <GateRowSkeleton key={i} measured note />}</Repeat>
          <div className="bg-well/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SkeletonLine className="h-5" bar="h-3" width="w-36" />
                <SkeletonLine className="mt-0.5 h-5" bar="h-2.5" width="w-2/3" />
              </div>
              <Skeleton className="h-7 w-24 shrink-0 rounded-xs" />
            </div>
            <SkeletonLine className="mt-2 h-5" bar="h-2.5" width="w-1/2" />
          </div>
        </div>
      </div>

      <div className="max-w-[760px] space-y-3" aria-hidden>
        <SkeletonLine className="h-6" bar="h-2.5" width="w-64 max-w-full" />
        <div className={cn(card, "divide-y divide-hairline overflow-hidden")}>
          <Repeat count={6}>{(i) => <GateRowSkeleton key={i} />}</Repeat>
        </div>
        <SkeletonLine className="h-5" bar="h-2.5" width="w-3/4" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8" aria-hidden>
        <div className={cn(card, "space-y-5 p-4 md:p-6")}>
          <CardHeaderSkeleton title="w-40" />
          <div className="grid grid-cols-2 gap-2">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="rounded-lg border border-hairline bg-well p-2.5">
                  <SkeletonLine className="h-6" bar="h-2" width="w-10" />
                  <SkeletonLine className="mt-0.5 h-5" bar="h-2.5" width="w-full" />
                  <SkeletonLine className="h-5" bar="h-2.5" width="w-1/2" />
                </div>
              )}
            </Repeat>
          </div>
          <div className="space-y-4">
            <div>
              <SkeletonLine className="mb-1.5 h-4" bar="h-2.5" width="w-10" />
              <Skeleton className="h-[102px] w-full rounded-md md:h-[70px]" />
              <SkeletonLine className="mt-1.5 h-4" bar="h-2" width="w-56 max-w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Repeat count={2}>
                {(i) => (
                  <div key={i}>
                    <SkeletonLine className="mb-1.5 h-4" bar="h-2.5" width="w-12" />
                    <Skeleton className="h-11 w-full rounded-md md:h-10" />
                  </div>
                )}
              </Repeat>
            </div>
            <div>
              <SkeletonLine className="mb-1.5 h-4" bar="h-2.5" width="w-24" />
              <Skeleton className="h-[82px] w-full rounded-md" />
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SkeletonLine className="h-6" bar="h-2" width="w-36" />
              <Skeleton className="h-11 w-full rounded-md sm:w-44 md:h-10" />
            </div>
          </div>
          <div className="space-y-2.5 border-t border-hairline pt-4">
            <div className="flex items-center justify-between gap-2">
              <SkeletonLine className="h-4" bar="h-2.5" width="w-32" />
              <SkeletonLine className="h-6" bar="h-2" width="w-16" />
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>

        <div className={cn(card, "space-y-5 p-4 md:p-6")}>
          <CardHeaderSkeleton title="w-32" />
          <div className="space-y-2">
            <Repeat count={4}>
              {(i) => <SkeletonLine key={i} className="h-5" bar="h-2.5" width={i === 3 ? "w-1/3" : "w-full"} />}
            </Repeat>
            <Repeat count={3}>
              {(i) => <SkeletonLine key={i} className="h-4" bar="h-2" width={i === 2 ? "w-1/2" : "w-full"} />}
            </Repeat>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="mb-1.5 h-4" bar="h-2.5" width="w-36" />
              <Skeleton className="h-11 w-full rounded-md md:h-10" />
            </div>
            <Skeleton className="h-11 w-20 shrink-0 rounded-md md:h-10" />
          </div>
          <div className="space-y-2.5">
            <Repeat count={2}>
              {(i) => (
                <div key={i} className="space-y-3 rounded-lg border border-hairline bg-well p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <SkeletonLine className="h-5" bar="h-3" width="w-40" />
                      <SkeletonLine className="mt-0.5 h-5" bar="h-2.5" width="w-24" />
                    </div>
                    <Skeleton className="h-11 w-[104px] shrink-0 rounded-md md:h-8" />
                  </div>
                  <SkeletonLine className="h-11 md:h-4" bar="h-2.5" width="w-20" />
                  <Skeleton className="h-11 w-[112px] rounded-md md:h-8" />
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </div>
    </>
  );
}

/** The whole route: header, scope picker + status strip, then the board. */
export function ValidationSkeleton() {
  return (
    <div className="space-y-8 pb-8 md:space-y-10 md:pb-12">
      <div
        className="flex flex-col gap-3 border-b border-hairline pb-4 md:flex-row md:items-end md:justify-between md:gap-6"
        aria-hidden
      >
        <div className="min-w-0 flex-1 space-y-1">
          <SkeletonLine className="h-[35px] md:h-10" bar="h-6 md:h-7" width="w-48" />
          <SkeletonLine className="h-6" bar="h-3" width="w-120 max-w-full" />
          <div>
            <SkeletonLine className="h-5" bar="h-2.5" width="w-full max-w-xl" />
            <SkeletonLine className="h-5" bar="h-2.5" width="w-1/3" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:pb-1">
          <Skeleton className="h-11 w-11 rounded-md md:h-8 md:w-8" />
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start" aria-hidden>
        <Skeleton className="h-11 shrink-0 rounded-md md:h-10 md:w-[240px]" />
        <div className="min-w-0 flex-1">
          <ValidationStatusSkeleton />
        </div>
      </div>

      <ValidationBoardSkeleton />
    </div>
  );
}
