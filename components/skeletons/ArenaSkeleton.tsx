import { Skeleton } from "@/components/ui/States";
import { ARENA_PASS_CLASS } from "@/components/arena/ArenaPass";
import { LoadingStatus, SkeletonHeading } from "./parts";

/**
 * Arena (/home) while today's pick loads. Shared by app/home/loading.tsx and
 * the page's own loading branch so navigation shows one skeleton, not a
 * spinner followed by a skeleton. Phone order matches the page: pass, rail,
 * up next, squad feed.
 */
export function ArenaSkeleton() {
  return (
    <div className="flex flex-col gap-6 select-none md:gap-8">
      <LoadingStatus label="Loading today's battle" />
      <SkeletonHeading title="w-32" subtitle="w-64 max-w-full" subtitleLine="h-5 md:h-6" />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8" aria-hidden>
        <div className="contents lg:col-span-8 lg:flex lg:min-w-0 lg:flex-col lg:gap-8">
          <div className={`pass order-1 ${ARENA_PASS_CLASS}`}>
            <div className="pass-body space-y-4">
              <Skeleton className="h-6 w-64 max-w-full" />
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-48" />
            </div>
            <div className="pass-stub justify-between p-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <Skeleton className="order-3 h-36 w-full rounded-lg" />
          <Skeleton className="order-4 h-44 w-full rounded-lg" />
        </div>
        <div className="order-2 flex min-w-0 flex-col gap-2.5 lg:col-span-4 lg:gap-3">
          <Skeleton className="h-7 w-36" />
          <div className="flex flex-col gap-2 lg:gap-3">
            <Skeleton className="h-[68px] w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-[68px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
