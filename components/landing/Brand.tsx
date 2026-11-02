import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The brand mark: a gold M whose shoulders rise into two peaks, one for each
 * side of a battle. Drawn on a 64-unit grid so it stays crisp from a 16px
 * favicon up. The same path lives in public/icon.svg (knocked out of a gold
 * tile); change both together.
 */
export const LOGO_PATH = "M6 54V17L17 8L32 30L47 8L58 17V54H48V29L32 51L16 29V54Z";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      focusable="false"
      className={cn("shrink-0 fill-primary", className)}
    >
      <path d={LOGO_PATH} />
    </svg>
  );
}

/**
 * The mark on its own, sized for the logged-out surfaces (landing, sign in,
 * offline) and the landing footer.
 */
export function Monogram({
  size = "md",
  className,
}: {
  /** sm 20px · md 24px · lg 28px */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <LogoMark
      className={cn(
        size === "sm" && "h-5 w-5",
        size === "md" && "h-6 w-6",
        size === "lg" && "h-7 w-7",
        className
      )}
    />
  );
}

/** Mark + wordmark, linking to the public landing. */
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
      className={cn("group inline-flex min-h-[44px] items-center gap-2.5", className)}
    >
      <Monogram size={size} className="transition-transform duration-200 group-hover:-translate-y-px" />
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
