import { Skeleton } from "@/components/ui/States";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/** A note card in the list column (the closed state of a notebook row). */
function NoteCardSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3.5 pb-3 pt-3.5">
      <SkeletonLine className="h-[22px]" bar="h-3.5" width={title} />
      <SkeletonLine className="mt-1 h-4" bar="h-2.5" width="w-2/5" />
      <div className="mt-2.5 flex items-center justify-between gap-2 lg:mt-3 lg:border-t lg:border-hairline lg:pt-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-xs" />
          <SkeletonLine className="h-4" bar="h-2.5" width="w-12" />
        </div>
        <SkeletonLine className="h-4" bar="h-2.5" width="w-8" />
      </div>
    </div>
  );
}

/**
 * /notebook while notes, shared notes and the vault load: heading row with
 * tabs, search and the New note action, then the two-pane list + reader.
 */
export function NotebookSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <LoadingStatus label="Loading notebook" />
      <div
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:border-b lg:border-hairline"
        aria-hidden
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <SkeletonLine className="h-9" bar="h-7" width="w-40" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-xs" />
          </div>
          <div className="-mx-4 flex gap-6 px-4 [box-shadow:inset_0_-1px_0_var(--color-hairline)] lg:mx-0 lg:px-0 lg:[box-shadow:none]">
            <Repeat count={4}>
              {(i) => (
                <div key={i} className="flex h-11 shrink-0 items-center">
                  <Skeleton className={["h-3.5 w-20 rounded-xs", "h-3.5 w-12 rounded-xs", "h-3.5 w-24 rounded-xs", "h-3.5 w-14 rounded-xs"][i]} />
                </div>
              )}
            </Repeat>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 lg:pb-3">
          <Skeleton className="h-10 min-w-0 flex-1 rounded-md lg:w-72 lg:flex-none" />
          <Skeleton className="h-11 w-32 shrink-0 rounded-md md:h-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" aria-hidden>
        <div className="flex flex-col gap-2">
          <NoteCardSkeleton title="w-3/4" />
          <NoteCardSkeleton title="w-1/2" />
          <NoteCardSkeleton title="w-2/3" />
          <NoteCardSkeleton title="w-3/5" />
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-hairline bg-surface lg:block">
          <div className="flex flex-col gap-3 border-b border-hairline p-6">
            <SkeletonLine className="h-[29px]" bar="h-5" width="w-2/3" />
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-6 w-40 rounded-xs" />
              <Skeleton className="h-6 w-20 rounded-xs" />
            </div>
          </div>
          <div className="space-y-2 p-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
