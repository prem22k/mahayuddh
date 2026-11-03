"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";
import { LogoMark } from "@/components/landing/Brand";

/**
 * Squad invite (/squad/join/[code]) while the preview loads.
 *
 * The card and the "what membership means" list are exported for the page's
 * own loading branch; SquadJoinSkeleton wraps them the way the page does:
 * inside the app shell when signed in, and with the page's own brand header
 * and footer when signed out (there is no shell then).
 */

/** InviteCard in its open-invite shape: pass header, avatars, name, facts, join, code row. */
export function InviteCardSkeleton() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-hairline bg-surface p-6 sm:p-8">
      <LoadingStatus label="Loading invite" />
      <div aria-hidden>
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-hairline pb-4 sm:mb-6">
          <SkeletonLine className="h-6" bar="h-2.5" width="w-36" />
          <Skeleton className="h-[30px] w-[110px] shrink-0 rounded-xs" />
        </div>

        <div className="mb-5 flex items-center justify-center sm:mb-6">
          <div className="flex items-center -space-x-3 p-1">
            <Repeat count={4}>
              {(i) => <Skeleton key={i} className="h-12 w-12 rounded-full border-2 border-surface" />}
            </Repeat>
          </div>
        </div>

        <div className="mb-4 flex flex-col items-center">
          <SkeletonLine className="mb-1 h-6 justify-center" bar="h-3" width="w-44" />
          <SkeletonLine className="h-9 justify-center sm:h-10" bar="h-7" width="w-56 max-w-full" />
        </div>

        <SkeletonLine className="mx-auto mb-5 h-6 max-w-[440px] justify-center sm:mb-6" bar="h-3.5" width="w-64 max-w-full" />

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-hairline bg-well p-2 sm:mb-7 sm:gap-2.5 sm:border-0 sm:bg-transparent sm:p-0">
          <Repeat count={2}>
            {(i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-raised px-2.5 py-3"
              >
                <SkeletonLine className="h-6 justify-center" bar="h-3.5" width={i === 0 ? "w-10" : "w-20"} />
                <SkeletonLine className="h-4 justify-center" bar="h-2.5" width="w-16" />
              </div>
            )}
          </Repeat>
        </div>

        <div className="mb-5">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>

        <div className="-mx-6 mb-4 border-t border-dashed border-hairline-strong sm:mx-0 sm:border-solid sm:border-hairline" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <SkeletonLine className="h-6" bar="h-2.5" width="w-20" />
            <Skeleton className="h-[26px] w-[84px] rounded-xs" />
          </div>
          <Skeleton className="h-11 w-[72px] shrink-0 rounded-sm sm:h-[26px] sm:w-[104px]" />
        </div>
      </div>
    </div>
  );
}

/** "What squad membership means": caption and three lines. */
export function InviteLinesSkeleton() {
  return (
    <div className="mx-auto mt-8 w-full max-w-[500px] px-3 sm:mt-10 sm:px-0" aria-hidden>
      <SkeletonLine className="mb-3 h-6" bar="h-2.5" width="w-48" />
      <div className="space-y-2.5">
        <Repeat count={3}>
          {(i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
              <SkeletonLine className="h-5" bar="h-3" width={["w-64", "w-72", "w-56"][i]} />
            </div>
          )}
        </Repeat>
      </div>
    </div>
  );
}

/** The whole route (app/squad/join/[code]/loading.tsx). */
export function SquadJoinSkeleton() {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="mx-auto w-full max-w-[560px] pb-8 pt-2 md:pt-6">
        <InviteCardSkeleton />
        <InviteLinesSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
      <header className="mx-auto flex h-14 w-full max-w-content items-center justify-between border-b border-hairline px-4 sm:px-8">
        <Link href="/welcome" className="flex items-center gap-2.5">
          <LogoMark className="h-[22px] w-[22px]" />
          <span className="font-display text-base font-semibold tracking-tight">Mahayuddh</span>
        </Link>
        <Skeleton className="h-11 w-[72px] rounded-sm sm:h-[34px]" />
      </header>

      <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-center px-4 pb-16 pt-6 sm:justify-center sm:py-12">
        <div className="w-full max-w-[560px]">
          <InviteCardSkeleton />
        </div>
        <InviteLinesSkeleton />
      </main>

      <footer className="mx-auto flex w-full max-w-content items-center justify-between gap-3 border-t border-hairline px-4 py-6 text-xs text-text-tertiary sm:px-8">
        <span>
          Mahayuddh <span aria-hidden>·</span> Practice with your own people
        </span>
      </footer>
    </div>
  );
}
