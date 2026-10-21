import React from "react";
import { cn } from "@/lib/utils";

/**
 * One of the landing's four example passes (Stitch stage 4).
 *
 * These are product illustrations, not records: every one carries an EXAMPLE
 * tag, and the names on them are the same cast the "one day in a squad"
 * timeline uses. Desktop fans them (a slight tilt that straightens on hover);
 * mobile stacks them as portrait passes with a perforated stub row.
 */
export function ExamplePass({
  label,
  tone = "primary",
  stub,
  caption,
  className,
  children,
}: {
  label: string;
  tone?: "primary" | "verified";
  /** [left, right] mono serials on the stub row. */
  stub: [React.ReactNode, React.ReactNode];
  /** Desktop-only footnote under the stub. */
  caption?: string;
  /** Desktop tilt, e.g. `md:-rotate-1`. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        "relative m-0 flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "md:rounded-xl md:p-7 md:hover:z-30 md:hover:-translate-y-2 md:hover:rotate-0 md:hover:scale-[1.03] md:hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.14)]",
        className
      )}
    >
      <div className="flex flex-col gap-2.5 p-4 md:gap-0 md:p-0">
        <div className="flex items-center justify-between gap-3 md:mb-5 md:border-b md:border-hairline md:pb-4">
          <span
            className={cn(
              "font-mono text-[10px] font-medium uppercase tracking-[0.06em] md:text-xs md:tracking-wider",
              tone === "verified" ? "text-verified" : "text-primary"
            )}
          >
            {label}
          </span>
          <span className="rounded-xs border border-hairline bg-well px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-tertiary md:bg-surface-raised md:px-2 md:text-[10px]">
            Example
          </span>
        </div>
        {children}
      </div>

      {/* Stub: a perforated row on mobile, a hairline-ruled footer on desktop. */}
      <div className="relative border-t border-dashed border-hairline-strong bg-surface-raised p-3 md:mt-4 md:border-solid md:border-hairline md:bg-transparent md:px-0 md:pb-0 md:pt-2">
        <span
          aria-hidden
          className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-hairline bg-canvas md:hidden"
        />
        <span
          aria-hidden
          className="absolute -right-2 -top-2 h-4 w-4 rounded-full border border-hairline bg-canvas md:hidden"
        />
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary tnum md:text-xs">
          <span className="truncate">{stub[0]}</span>
          <span className="shrink-0 text-text-secondary md:text-text-tertiary">{stub[1]}</span>
        </div>
      </div>

      {caption && (
        <figcaption className="mt-4 hidden pt-3 text-[11px] leading-4 text-text-tertiary md:block">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
