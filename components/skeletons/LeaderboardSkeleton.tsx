import { Skeleton } from "@/components/ui/States";
import { boardListCls, boardRowCls } from "@/components/leaderboard/rowStyles";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/** Board rows (squad and global) while standings load: the real 56px row geometry. */
export function BoardRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={boardListCls} aria-hidden>
      <Repeat count={count}>
        {(i) => (
          <div key={i} className={boardRowCls()}>
            <Skeleton className="h-5 w-5 shrink-0 rounded-xs md:h-7 md:w-7" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-5" width={["w-28", "w-24", "w-32", "w-20"][i % 4]} />
              <SkeletonLine className="h-4 md:hidden" bar="h-2.5" width="w-16" />
            </div>
            <SkeletonLine className="h-5 shrink-0 md:h-7" bar="h-3.5 md:h-4" width="w-12" />
            <Skeleton className="hidden h-8 w-[144px] shrink-0 rounded-xs md:block" />
          </div>
        )}
      </Repeat>
    </div>
  );
}

/** A segmented control (h-9; 44px buttons on phones). */
function SegmentedSkeleton({ width }: { width: string }) {
  return <Skeleton className={`h-[52px] shrink-0 rounded-md md:h-9 ${width}`} />;
}

/** The whole /leaderboard route. */
export function LeaderboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-reading flex-col">
      <LoadingStatus label="Loading leaderboard" />
      <div className="flex items-center justify-between gap-4 pb-4 md:pb-6" aria-hidden>
        <SkeletonLine className="h-[29px] md:h-9" bar="h-6 md:h-7" width="w-44" />
        <SegmentedSkeleton width="w-36" />
      </div>
      <div
        className="flex flex-col gap-3 border-b border-hairline pb-4 md:flex-row md:items-center md:justify-between md:pb-6"
        aria-hidden
      >
        <div className="flex gap-2 overflow-hidden">
          <Repeat count={4}>
            {(i) => <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full md:h-8" />}
          </Repeat>
        </div>
        <div className="flex items-center justify-between gap-3 md:shrink-0">
          <SkeletonLine className="h-4 md:hidden" bar="h-2.5" width="w-24" />
          <SegmentedSkeleton width="w-48" />
        </div>
      </div>
      <div className="mt-4 md:mt-6">
        <BoardRowsSkeleton />
      </div>
    </div>
  );
}
