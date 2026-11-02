import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/utils";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * Profile & settings (/profile) while auth resolves. Shared by
 * app/profile/loading.tsx and the page, which would otherwise draw "You",
 * "LeetCode not connected" and an empty email for a beat before the real
 * profile arrives. Same column grid, cards and row heights as the page.
 */

/** outlineAction: 44px on phones, 32px from md. */
const action = "h-11 shrink-0 rounded-md md:h-8";

/** SettingsCard frame: title (+ badge) and description, action on the right. */
function CardSkeleton({
  title,
  description = "w-56",
  badge,
  actionWidth,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  actionWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 md:p-6" aria-hidden>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonLine className="h-5 md:h-6" bar="h-3 md:h-3.5" width={title} />
            {badge && <Skeleton className={cn("h-5 rounded-full", badge)} />}
          </div>
          <SkeletonLine className="mt-0.5 h-5" bar="h-2.5" width={`${description} max-w-full`} />
        </div>
        {actionWidth && <Skeleton className={cn(action, actionWidth)} />}
      </div>
      <div className="mt-3 md:mt-4">{children}</div>
    </div>
  );
}

/** SettingsField: small label over the value. */
function FieldSkeleton({ value, withAction }: { value: string; withAction?: boolean }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <SkeletonLine className="h-4" bar="h-2" width="w-16" />
        <SkeletonLine className="h-5" bar="h-3" width={value} />
      </div>
      {withAction && <Skeleton className={cn(action, "w-[132px]")} />}
    </div>
  );
}

/** SettingsRow with a switch: label + caption, 44px control on the right. */
function SwitchRowSkeleton({ label, caption }: { label: string; caption: string }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <SkeletonLine className="h-5" bar="h-3" width={label} />
        <SkeletonLine className="h-4" bar="h-2" width={`${caption} max-w-full`} />
      </div>
      <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end">
        <Skeleton className="h-5 w-9 rounded-full md:w-10" />
      </div>
    </div>
  );
}

/** The Squads card's list while getMySquads runs (one row: badge, name + season, Open). */
export function ProfileSquadsSkeleton() {
  return (
    <div className="divide-y divide-hairline" aria-hidden>
      <div className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 md:gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-xs md:h-8 md:w-8 md:rounded-md" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-4" bar="h-2.5" width="w-32" />
            <SkeletonLine className="mt-0.5 h-4" bar="h-2" width="w-24" />
          </div>
        </div>
        <Skeleton className={cn(action, "w-[60px]")} />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="pb-8 md:pb-16">
      <LoadingStatus label="Loading profile" />
      <div className="grid gap-10 lg:grid-cols-[192px_minmax(0,680px)]">
        {/* "Jump to" rail (desktop). */}
        <div className="hidden lg:block" aria-hidden>
          <div className="flex flex-col gap-1 pt-2">
            <SkeletonLine className="mb-1 h-6 px-3" bar="h-2" width="w-14" />
            <Repeat count={7}>
              {(i) => (
                <div key={i} className="flex h-[30px] items-center gap-2 px-3">
                  <span className="h-1.5 w-1.5 shrink-0" />
                  <Skeleton className={cn("h-2.5 rounded-xs", i % 3 === 0 ? "w-20" : i % 3 === 1 ? "w-16" : "w-24")} />
                </div>
              )}
            </Repeat>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5 md:gap-8">
          {/* Overview. */}
          <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 md:p-6" aria-hidden>
            <div className="flex items-start gap-3.5 md:gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full md:h-20 md:w-20" />
              <div className="min-w-0 flex-1 md:pt-1">
                <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
                  <SkeletonLine className="h-7 md:h-8" bar="h-4 md:h-5" width="w-32" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
                <SkeletonLine className="mt-1 h-4" bar="h-2.5" width="w-56 max-w-full" />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 md:mt-5 md:flex-row md:items-center md:justify-between md:pt-5">
              <SkeletonLine className="h-4" bar="h-2.5" width="w-60 max-w-full" />
              <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2.5">
                <Skeleton className="h-11 rounded-md md:h-9 md:w-[100px]" />
                <Skeleton className="h-11 rounded-md md:h-9 md:w-[150px]" />
              </div>
            </div>
          </div>

          <CardSkeleton title="w-16" description="w-40">
            <div className="divide-y divide-hairline">
              <FieldSkeleton value="w-28" />
              <FieldSkeleton value="w-40" />
              <FieldSkeleton value="w-48 max-w-full" />
              <FieldSkeleton value="w-36" withAction />
            </div>
          </CardSkeleton>

          <CardSkeleton title="w-36" description="w-64" badge="w-20">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-well p-3 md:flex-row md:items-center md:justify-between md:p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-xs md:h-8 md:w-8 md:rounded-md" />
                  <div className="min-w-0">
                    <SkeletonLine className="h-11 md:h-5" bar="h-3" width="w-28" />
                    <SkeletonLine className="h-4" bar="h-2" width="w-36" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-11 flex-1 rounded-md md:h-8 md:w-[92px] md:flex-none" />
                  <Skeleton className={cn(action, "w-[92px]")} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-raised p-3 md:p-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <SkeletonLine className="h-4" bar="h-2.5" width="w-28" />
                  <SkeletonLine className="h-4" bar="h-2" width="w-64 max-w-full" />
                </div>
                <Skeleton className={cn(action, "w-[68px]")} />
              </div>
            </div>
          </CardSkeleton>

          <CardSkeleton title="w-32" description="w-44">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-11 w-[124px] rounded-full md:h-8" />
              <Skeleton className="h-11 w-[116px] rounded-full md:h-8" />
              <Skeleton className="h-11 w-[132px] rounded-full md:h-8" />
            </div>
          </CardSkeleton>

          <CardSkeleton title="w-16" description="w-72" actionWidth="w-[128px]">
            <ProfileSquadsSkeleton />
          </CardSkeleton>

          <CardSkeleton title="w-28" description="w-64">
            <div className="divide-y divide-hairline">
              <SwitchRowSkeleton label="w-44" caption="w-40" />
              <SwitchRowSkeleton label="w-32" caption="w-64" />
              <SwitchRowSkeleton label="w-40" caption="w-60" />
              <SwitchRowSkeleton label="w-52" caption="w-72" />
              <SwitchRowSkeleton label="w-36" caption="w-36" />
              <div className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <SkeletonLine className="h-5" bar="h-3" width="w-24" />
                  <SkeletonLine className="h-4" bar="h-2" width="w-72 max-w-full" />
                </div>
                <SkeletonLine className="h-4 shrink-0" bar="h-2.5" width="w-24" />
              </div>
            </div>
            <SkeletonLine className="mt-1 h-6 md:hidden" bar="h-2" width="w-40" />
          </CardSkeleton>

          <CardSkeleton title="w-32" description="w-52">
            <div className="flex flex-col">
              <div className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex flex-col gap-0.5">
                  <SkeletonLine className="h-5" bar="h-3" width="w-60 max-w-full" />
                  <SkeletonLine className="h-4" bar="h-2" width="w-28" />
                </div>
                <Skeleton className="h-[54px] w-full rounded-md md:h-9 md:w-[240px] md:shrink-0" />
              </div>
              <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-hairline py-2.5 md:py-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <SkeletonLine className="h-5" bar="h-3" width="w-14" />
                  <SkeletonLine className="h-4" bar="h-2" width="w-72 max-w-full" />
                </div>
                <SkeletonLine className="h-4 shrink-0" bar="h-2.5" width="w-12" />
              </div>
            </div>
          </CardSkeleton>

          <div className="flex flex-col gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-between" aria-hidden>
            <Skeleton className="h-11 rounded-md md:h-9 md:w-[88px]" />
            <Skeleton className="h-11 rounded-md md:h-9 md:w-[120px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
