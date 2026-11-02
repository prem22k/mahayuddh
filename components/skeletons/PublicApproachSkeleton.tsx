"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/States";
import { safeNext } from "@/lib/safeNext";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";
import { LogoMark } from "@/components/landing/Brand";

/**
 * Public approach (/a/[id]) while the server reads it. The page brings its
 * own header and reading column whether or not anyone is signed in, so the
 * header here is the real one (same ?next= links); the body draws the author
 * card, the core idea, and the detail rows.
 */
export function PublicApproachSkeleton() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const nextParam = encodeURIComponent(safeNext(`/a/${id}`) ?? "/home");

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="mx-auto flex h-14 w-full max-w-reading items-center justify-between px-4">
        <Link href="/welcome" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <LogoMark className="h-5 w-5" />
          Mahayuddh
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/login?next=${nextParam}`}
            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          >
            Sign in
          </Link>
          <Link
            href={`/login?mode=signup&next=${nextParam}`}
            className="inline-flex min-h-[44px] items-center rounded-md bg-surface-overlay px-4 text-sm font-medium text-text-primary hover:bg-surface-raised"
          >
            Start your squad
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-reading flex-col gap-5 px-4 pb-16 pt-6 md:gap-6">
        <LoadingStatus label="Loading approach" />
        <SkeletonLine className="min-h-[44px]" bar="h-3" width="w-72 max-w-full" />

        {/* ApproachHeaderCard: author row, then problem title + chips and the proof box. */}
        <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 md:p-5" aria-hidden>
          <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full md:h-10 md:w-10" />
              <div className="min-w-0">
                <SkeletonLine className="h-5" bar="h-3" width="w-28" />
                <div className="mt-1 flex items-center gap-2">
                  <Skeleton className="h-5 w-14 rounded-xs" />
                  <SkeletonLine className="h-4" bar="h-2.5" width="w-12" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <SkeletonLine className="h-[26px]" bar="h-4" width="w-64 max-w-full" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-[42px] w-full rounded-lg md:h-[58px] md:w-48 md:shrink-0" />
          </div>
        </div>

        {/* Core idea. */}
        <div className="relative overflow-hidden rounded-xl border border-hairline bg-well p-4 md:p-6" aria-hidden>
          <div className="mb-3 flex items-center justify-between">
            <SkeletonLine className="h-4" bar="h-2.5" width="w-16" />
            <Skeleton className="h-4 w-4 rounded-xs" />
          </div>
          <SkeletonLine className="h-7" bar="h-3.5" width="w-full" />
          <SkeletonLine className="h-7" bar="h-3.5" width="w-full" />
          <SkeletonLine className="h-7" bar="h-3.5" width="w-2/5" />
        </div>

        {/* Details: Time and Space on one line, the prose rows stacked on a phone. */}
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface" aria-hidden>
          <Repeat count={2}>
            {(i) => (
              <div key={i} className="flex items-center justify-between gap-4 p-3 md:p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-xs" />
                  <SkeletonLine className="h-5" bar="h-3" width="w-12" />
                </div>
                <SkeletonLine className="h-5" bar="h-3" width="w-16" />
              </div>
            )}
          </Repeat>
          <div className="flex flex-col gap-1.5 p-3 md:flex-row md:items-start md:justify-between md:gap-6 md:p-4">
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-xs" />
              <SkeletonLine className="h-5" bar="h-3" width="w-20" />
            </div>
            <div className="min-w-0 flex-1 md:flex md:max-w-[70%] md:flex-col md:items-end">
              <SkeletonLine className="h-6" bar="h-3" width="w-full" />
              <SkeletonLine className="h-6" bar="h-3" width="w-1/2" />
            </div>
          </div>
        </div>

        <div
          className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:p-4"
          aria-hidden
        >
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-[38px] w-20 rounded-full" />
            <Skeleton className="h-[38px] w-[72px] rounded-full" />
            <Skeleton className="h-[38px] w-10 rounded-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-md sm:w-[156px]" />
        </div>
      </main>
    </div>
  );
}
