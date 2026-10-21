import { cn } from "@/lib/utils";

/**
 * Shared row geometry for the squad and global boards (Stitch leaderboard
 * frames): separate 56px cards on desktop, one divided list on phones.
 */
export const boardListCls =
  "flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface max-md:divide-y max-md:divide-hairline md:gap-2 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent";

export function boardRowCls(highlight = false) {
  return cn(
    "group relative flex h-14 items-center gap-3 px-3 transition-colors md:gap-4 md:rounded-md md:border md:px-4",
    highlight
      ? "bg-surface-overlay max-md:border-l-2 max-md:border-l-primary md:border-hairline-strong md:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]"
      : "bg-surface hover:bg-surface-raised md:border-hairline md:hover:border-hairline-strong md:hover:bg-surface"
  );
}

/** Rank numeral: top three in text-primary, the rest secondary. No medals, no gold. */
export function boardRankCls(rank: number) {
  return cn(
    "w-5 shrink-0 text-center font-display text-lg font-medium leading-none tnum md:w-7 md:text-[28px] md:font-semibold md:tracking-[-0.02em]",
    rank <= 3 ? "text-text-primary" : "text-text-secondary"
  );
}

/** 32px action chip for desktop rows (phones get a 44px icon button instead). */
export const boardActionCls =
  "relative inline-flex h-8 shrink-0 items-center justify-center rounded-xs border border-hairline bg-surface-raised px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary";
