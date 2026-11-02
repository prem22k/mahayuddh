"use client";

import { Skeleton } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { LoadingStatus, Repeat, SkeletonHeading, SkeletonLine, SkeletonTabs } from "./parts";

/** One feed card (FeedEventCard): avatar, headline + time, then the mini proof well. */
function FeedCardSkeleton({ proof = true }: { proof?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3 md:p-4">
      <div className="flex items-start gap-2 md:gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full md:h-9 md:w-9" />
        <div className="min-w-0 flex-1">
          <SkeletonLine className="h-6" bar="h-3.5" width="w-3/5" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-12" />
        </div>
      </div>
      {proof && (
        <div className="space-y-2 rounded-md border border-hairline bg-well p-3 md:space-y-1.5 md:p-3.5">
          <SkeletonLine className="h-5" width="w-2/5" />
          <Skeleton className="h-6 w-24 rounded-xs" />
        </div>
      )}
    </div>
  );
}

/** The feed list while it loads (the page's own loading branch). */
export function FeedListSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:gap-4" aria-hidden>
      <FeedCardSkeleton />
      <FeedCardSkeleton proof={false} />
      <FeedCardSkeleton />
    </div>
  );
}

/** The squad week summary rail (SquadWeekRail), desktop only. */
function SquadRailSkeleton() {
  return (
    <div className="hidden flex-col gap-4 lg:flex" aria-hidden>
      <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
        <SkeletonLine className="h-5" width="w-3/4" />
        <div className="flex flex-col divide-y divide-hairline">
          <Repeat count={4}>
            {(i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                <SkeletonLine className="h-4" bar="h-2.5" width="w-16" />
                <SkeletonLine className="h-5" width="w-8" />
              </div>
            )}
          </Repeat>
        </div>
      </div>
      <Skeleton className="h-[66px] w-full rounded-lg" />
    </div>
  );
}

/** The whole /feed route (app/feed/loading.tsx). */
export function FeedSkeleton() {
  const { profile } = useAuth();
  const hasSquad = !!profile?.active_squad_id;
  return (
    <div className="flex flex-col gap-6">
      <LoadingStatus label="Loading feed" />
      <div>
        <SkeletonHeading
          title="w-24"
          titleLine="h-[31px] md:h-9"
          subtitle="w-56"
          subtitleLine="h-4 md:h-6"
        />
        <SkeletonTabs count={4} className="mt-4 md:mt-5" />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-8 xl:grid-cols-[minmax(0,680px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          {hasSquad && <Skeleton className="h-[86px] w-full rounded-lg lg:hidden" />}
          <div className="hidden items-center gap-3 rounded-lg border border-hairline bg-surface p-4 md:flex" aria-hidden>
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-[42px] flex-1 rounded-md" />
            <Skeleton className="h-10 w-16 shrink-0 rounded-md" />
          </div>
          <FeedListSkeleton />
        </div>
        {hasSquad && <SquadRailSkeleton />}
      </div>
    </div>
  );
}
