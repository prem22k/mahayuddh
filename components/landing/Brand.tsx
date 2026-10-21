import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The logged-out brand mark (Stitch: landing, sign in, offline): a gold "M" on
 * a quiet tile. Inside the app the shell carries the brand; these surfaces
 * render without it, so they carry their own.
 */
export function Monogram({
  size = "md",
  className,
}: {
  /** sm 24px · md 28px · lg 32px */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-hairline-strong bg-surface font-display font-bold leading-none text-primary",
        size === "sm" && "h-6 w-6 rounded-xs text-xs",
        size === "md" && "h-7 w-7 rounded-xs text-sm",
        size === "lg" && "h-8 w-8 rounded-md text-base",
        className
      )}
    >
      M
    </span>
  );
}

/** Monogram + wordmark, linking to the public landing. */
export function Wordmark({
  href = "/welcome",
  size = "md",
  className,
  textClassName,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  textClassName?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Mahayuddh"
      className={cn("group inline-flex min-h-[44px] items-center gap-2", className)}
    >
      <Monogram size={size} className="transition-colors group-hover:border-primary" />
      <span
        className={cn(
          "font-display text-lg font-semibold tracking-tight text-text-primary",
          textClassName
        )}
      >
        Mahayuddh
      </span>
    </Link>
  );
}
