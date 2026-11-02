"use client";

import { Skeleton } from "@/components/ui/States";
import { ArtifactFrame } from "@/components/recap/ArtifactChrome";
import { LoadingStatus, Repeat, SkeletonLine, SkeletonTabs } from "./parts";

/**
 * Public portfolio (/u/[username]) while the server reads it. The page is a
 * server component, so this is what app/u/[username]/loading.tsx shows. It
 * sits in the same ArtifactFrame as PublicPortfolio (crumb included) and
 * draws the common case: identity with "often teaches" and a journey line,
 * the featured Pass, the five dimensions, and the teaching tabs.
 */
export function PublicProfileSkeleton() {
  return (
    <ArtifactFrame signInHref="/login" crumb="Public profile" className="max-w-content">
      <LoadingStatus label="Loading profile" />
      <div className="space-y-10 md:space-y-12" aria-hidden>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Identity: avatar | actions, then the name (phone); avatar | name, actions last (desktop). */}
          <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3.5 md:gap-x-5 md:gap-y-5 lg:col-span-7">
            <Skeleton className="col-start-1 row-start-1 h-16 w-16 rounded-full md:h-24 md:w-24" />
            <div className="col-span-2 row-start-2 min-w-0 space-y-1.5 md:col-span-1 md:col-start-2 md:row-start-1 md:self-center">
              <SkeletonLine className="h-[30px] md:h-[38px]" bar="h-6 md:h-7" width="w-48" />
              <SkeletonLine className="h-5" bar="h-3" width="w-56 max-w-full" />
            </div>
            <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end pt-1 md:col-span-2 md:col-start-1 md:row-start-4 md:gap-3 md:justify-self-start">
              <Skeleton className="h-11 w-[92px] rounded-md md:h-10 md:w-[108px]" />
              <Skeleton className="h-11 w-[84px] rounded-md md:h-10 md:w-[96px]" />
            </div>
            <div className="col-span-2 row-start-3 flex flex-wrap items-center gap-2 md:row-start-2">
              <SkeletonLine className="h-6" bar="h-3" width="w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="col-span-2 row-start-4 max-w-[620px] md:row-start-3">
              <SkeletonLine className="h-6" bar="h-3" width="w-full" />
              <SkeletonLine className="h-6" bar="h-3" width="w-2/3" />
            </div>
          </div>

          {/* Featured approach Pass. */}
          <div className="w-full lg:col-span-5">
            <div className="flex items-center justify-between px-1 pb-2">
              <SkeletonLine className="h-4" bar="h-2.5" width="w-32" />
            </div>
            <div className="pass md:min-h-[220px] [&>.pass-body]:p-5 md:[&>.pass-body]:p-6">
              <div className="pass-body">
                <div className="flex h-full flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <SkeletonLine className="h-7" bar="h-4" width="w-3/4" />
                  </div>
                  <div>
                    <Skeleton className="h-[30px] w-28 rounded-xs md:h-9" />
                    <SkeletonLine className="mt-1.5 h-4" bar="h-2.5" width="w-36" />
                  </div>
                  <div>
                    <SkeletonLine className="h-6" bar="h-3" width="w-full" />
                    <SkeletonLine className="h-6" bar="h-3" width="w-1/2" />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
                    <SkeletonLine className="h-11 md:h-4" bar="h-2.5" width="w-24" />
                  </div>
                </div>
              </div>
              <div className="pass-stub justify-between p-4 md:p-5 max-md:flex-row max-md:items-center">
                <div className="flex min-w-0 flex-col gap-2">
                  <Repeat count={2}>
                    {(i) => (
                      <div key={i} className="flex flex-col">
                        <SkeletonLine className="h-4" bar="h-2" width="w-12" />
                        <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
                      </div>
                    )}
                  </Repeat>
                </div>
                <Skeleton className="h-12 w-12 shrink-0 rounded-full md:mt-2" />
              </div>
            </div>
          </div>
        </div>

        {/* Proof of practice: five dimensions. */}
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-2.5">
            <SkeletonLine className="h-7" bar="h-4" width="w-40" />
            <SkeletonLine className="h-4" bar="h-2.5" width="w-20" />
          </div>
          <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
            <Repeat count={5}>
              {(i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 p-3.5 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1 md:max-w-xl">
                    <div className="flex items-center justify-between gap-3 md:justify-start">
                      <SkeletonLine className="h-4 md:h-5" bar="h-2.5 md:h-3" width="w-24" />
                      <SkeletonLine className="h-4 md:hidden" bar="h-2.5" width="w-24" />
                    </div>
                    <SkeletonLine className="h-4" bar="h-2" width={i % 2 === 0 ? "w-3/4" : "w-2/3"} />
                  </div>
                  <SkeletonLine className="hidden h-7 shrink-0 md:flex" bar="h-3.5" width="w-32" />
                </div>
              )}
            </Repeat>
          </div>
        </div>

        {/* Public teaching: tabs + approach rows. */}
        <div className="space-y-4 md:space-y-6">
          <SkeletonTabs count={2} />
          <div className="space-y-2 md:space-y-3">
            <Repeat count={3}>
              {(i) => (
                <div
                  key={i}
                  className="rounded-lg border border-hairline bg-surface p-3 md:rounded-xl md:p-5"
                >
                  <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5 md:space-y-2">
                      <div className="flex items-center justify-between gap-2 md:justify-start md:gap-2.5">
                        <SkeletonLine className="h-4 md:h-6" bar="h-2.5 md:h-3.5" width={i === 1 ? "w-36" : "w-48"} />
                        <div className="hidden shrink-0 items-center gap-2 md:flex">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:hidden">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <SkeletonLine className="h-[15px] md:h-6" bar="h-2 md:h-3" width="w-4/5" />
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline pt-1.5 md:justify-end md:border-0 md:pt-0">
                      <SkeletonLine className="h-4" bar="h-2.5" width="w-16" />
                      <Skeleton className="hidden h-4 w-4 rounded-xs md:block" />
                    </div>
                  </div>
                </div>
              )}
            </Repeat>
          </div>
        </div>
      </div>
    </ArtifactFrame>
  );
}
