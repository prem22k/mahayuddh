import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonHeading, SkeletonLine } from "./parts";

/** Notification rows inside a day block, while the history loads. */
export function NotificationRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface" aria-hidden>
      <Repeat count={count}>
        {(i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-5" width={i % 2 ? "w-1/2" : "w-2/3"} />
              <SkeletonLine className="h-5" bar="h-2.5" width="w-4/5" />
              <SkeletonLine className="mt-1 h-4" bar="h-2.5" width="w-24" />
            </div>
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** The whole /notifications route. */
export function NotificationsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-reading flex-col gap-6">
      <LoadingStatus label="Loading notifications" />
      <div className="flex items-end justify-between gap-4" aria-hidden>
        <SkeletonHeading title="w-52" subtitle="w-72 max-w-full" />
        <Skeleton className="h-10 w-32 shrink-0 rounded-md" />
      </div>
      <div className="flex flex-col gap-2" aria-hidden>
        <SkeletonLine className="h-4" bar="h-2.5" width="w-16" />
        <NotificationRowsSkeleton count={3} />
      </div>
      <div className="flex flex-col gap-2" aria-hidden>
        <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
        <NotificationRowsSkeleton count={2} />
      </div>
    </div>
  );
}
