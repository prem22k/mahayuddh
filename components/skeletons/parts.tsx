import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/States";

/**
 * Building blocks for page skeletons (DESIGN.md: loading uses skeletons in
 * surface-raised that match the final layout). Every block reserves the real
 * element's box, so swapping the skeleton for content does not move anything.
 */

/**
 * One line of text. The outer box keeps the real line-height; the bar sits
 * inside it so a run of lines reads as text, not as a stack of slabs.
 */
export function SkeletonLine({
  className,
  bar = "h-3",
  width = "w-full",
}: {
  /** The real line's height, e.g. "h-5" for leading-5 or "h-9" for a display heading. */
  className?: string;
  /** Bar height inside the line box. */
  bar?: string;
  width?: string;
}) {
  return (
    <div className={cn("flex h-5 items-center", className)} aria-hidden>
      <Skeleton className={cn("rounded-xs", bar, width)} />
    </div>
  );
}

/**
 * A page heading: optional breadcrumb, the display title (type-display-md,
 * 36px line), and an optional one-line subtitle (15px / 24px).
 */
export function SkeletonHeading({
  className,
  title = "w-48",
  titleLine = "h-9",
  subtitle = "w-72 max-w-full",
  subtitleLine = "h-6",
  crumb,
  gap = "gap-1",
}: {
  className?: string;
  title?: string;
  /** The title's line box; type-display-md is a 36px line. */
  titleLine?: string;
  /** Width of the subtitle bar, or null for no subtitle. */
  subtitle?: string | null;
  /** The subtitle's line box (its real line-height). */
  subtitleLine?: string;
  /** Width of a breadcrumb bar above the title (44px tap row on phones). */
  crumb?: string;
  gap?: string;
}) {
  return (
    <div className={cn("flex flex-col", gap, className)} aria-hidden>
      {crumb && <SkeletonLine className="mb-1 min-h-[44px] md:min-h-0" bar="h-3" width={crumb} />}
      <SkeletonLine className={titleLine} bar="h-7" width={title} />
      {subtitle && <SkeletonLine className={subtitleLine} bar="h-3.5" width={subtitle} />}
    </div>
  );
}

/** An underline tab row (UnderlineTabs): same height and hairline as the real one. */
export function SkeletonTabs({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  const widths = ["w-14", "w-16", "w-12", "w-20", "w-14"];
  return (
    <div className={cn("flex gap-6 border-b border-hairline", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-10 min-h-[44px] items-center md:min-h-0">
          <Skeleton className={cn("h-3.5 rounded-xs", widths[i % widths.length])} />
        </div>
      ))}
    </div>
  );
}

/**
 * A bordered row card: leading avatar or icon, two lines of text, and an
 * optional trailing chip. Most lists in the app are this shape.
 */
export function SkeletonRow({
  className,
  lead = "h-9 w-9 rounded-full",
  title = "w-1/2",
  meta = "w-1/3",
  trail = "h-6 w-16",
}: {
  className?: string;
  /** Leading avatar/icon box, or null for none. */
  lead?: string | null;
  title?: string;
  /** Width of the second line, or null for a single line. */
  meta?: string | null;
  /** Trailing element box, or null for none. */
  trail?: string | null;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-hairline bg-surface p-3 md:p-4",
        className
      )}
      aria-hidden
    >
      {lead && <Skeleton className={cn("shrink-0", lead)} />}
      <div className="min-w-0 flex-1">
        <SkeletonLine className="h-6" bar="h-3.5" width={title} />
        {meta && <SkeletonLine className="h-4" bar="h-2.5" width={meta} />}
      </div>
      {trail && <Skeleton className={cn("shrink-0 rounded-md", trail)} />}
    </div>
  );
}

/** Repeat a skeleton `count` times. */
export function Repeat({
  count,
  children,
}: {
  count: number;
  children: (i: number) => React.ReactNode;
}) {
  return <>{Array.from({ length: count }, (_, i) => children(i))}</>;
}

/** Screen-reader status for a loading region; the bars themselves are aria-hidden. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}
