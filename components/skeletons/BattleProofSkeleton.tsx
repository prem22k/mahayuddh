"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/States";
import { ArtifactFrame } from "@/components/recap/ArtifactChrome";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * Shared proof link (/b/[id]) while the server reads the battle. The page is
 * a server component, so this is what app/b/[id]/loading.tsx shows. It uses
 * ProofView's own ArtifactFrame and crumb, then draws the proof Pass, the
 * stats line, and the action row.
 */
export function BattleProofSkeleton() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  return (
    <ArtifactFrame signInHref="/login" crumb={`Proof #${id.slice(0, 8)}`} className="max-w-content">
      <LoadingStatus label="Loading proof" />
      <div className="mx-auto flex w-full max-w-[780px] flex-col items-center md:pt-6" aria-hidden>
        <div className="pass w-full shadow-overlay [&>.pass-body]:p-5 md:[&>.pass-body]:p-9">
          <div className="pass-body">
            <div className="flex h-full flex-col justify-between gap-5 md:gap-6">
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-3 md:mb-3">
                  <SkeletonLine className="h-4" bar="h-2" width="w-40" />
                  <SkeletonLine className="h-4" bar="h-2" width="w-20" />
                </div>
                <SkeletonLine className="mb-3 h-[27px] md:mb-4 md:h-[34px]" bar="h-5 md:h-6" width="w-3/5" />
                <div className="mb-5 flex flex-wrap items-center gap-2 md:mb-7 md:gap-2.5">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-11 w-40 rounded-md md:h-14 md:w-48" />
                <SkeletonLine className="mt-2 h-5" bar="h-3" width="w-48" />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3 md:pt-6">
                <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full md:h-10 md:w-10" />
                  <SkeletonLine className="h-5" bar="h-3" width="w-24" />
                </div>
                <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
              </div>
            </div>
          </div>
          <div className="pass-stub justify-between gap-6 md:basis-[244px] md:p-8 max-md:flex-row max-md:items-center max-md:gap-4 max-md:px-5 max-md:py-4">
            <div className="flex min-w-0 flex-col gap-2.5 md:gap-4">
              <Repeat count={3}>
                {(i) => (
                  <div key={i} className="flex flex-col">
                    <SkeletonLine className="h-4" bar="h-2" width="w-14" />
                    <SkeletonLine className="h-4" bar="h-2.5" width={i === 1 ? "w-28" : "w-20"} />
                  </div>
                )}
              </Repeat>
            </div>
            <Skeleton className="h-16 w-16 shrink-0 rounded-full md:mx-auto md:mt-4 md:h-24 md:w-24" />
          </div>
        </div>

        <div className="mt-4 flex w-full flex-col gap-2.5 px-1 md:mt-6 md:flex-row md:items-center md:justify-between md:gap-4 md:px-2">
          <SkeletonLine className="h-5" bar="h-2.5" width="w-56" />
          <div className="rounded-lg border border-hairline bg-surface p-2.5 md:border-0 md:bg-transparent md:p-0">
            <SkeletonLine className="h-5" bar="h-2.5" width="w-64 max-w-full" />
          </div>
        </div>

        <div className="mt-5 flex w-full flex-col gap-2 sm:mt-8 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3">
          <Skeleton className="h-12 w-full rounded-md sm:h-11 sm:w-44" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <Skeleton className="h-11 rounded-md sm:w-[172px]" />
            <Skeleton className="h-11 rounded-md sm:w-[124px]" />
          </div>
        </div>

        <div className="mt-8 flex w-full justify-center border-t border-hairline pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-11 w-36 rounded-md" />
            <Skeleton className="h-11 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </ArtifactFrame>
  );
}
