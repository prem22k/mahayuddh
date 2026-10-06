import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function problemUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

export function profileUrl(handle: string): string {
  return `https://leetcode.com/${handle}/`;
}

interface ProblemLinkProps {
  slug: string;
  /** Tooltip / accessible name. Defaults to "Open on LeetCode". */
  title?: string;
  variant?: "icon" | "pill";
  className?: string;
  iconClassName?: string;
}

/** External LeetCode anchor. Always stops propagation (never triggers row actions). */
export function ProblemLink({
  slug,
  title,
  variant = "icon",
  className,
  iconClassName = "w-3.5 h-3.5",
}: ProblemLinkProps) {
  const label = title ?? "Open on LeetCode";
  if (variant === "pill") {
    return (
      <a
        href={problemUrl(slug)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={label}
        className={cn(
          "px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white font-semibold flex items-center gap-1.5 transition-colors text-[11px]",
          className
        )}
      >
        <span>LeetCode</span>
        <ExternalLink className="w-3 h-3 text-white/50" />
      </a>
    );
  }
  return (
    <a
      href={problemUrl(slug)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={label}
      aria-label={label}
      /* A 14px glyph in a padding-less anchor measured 14x14 — untappable.
         44px on touch, natural size on desktop where the mouse is precise. */
      className={cn(
        "inline-flex items-center justify-center min-h-11 min-w-11 md:min-h-0 md:min-w-0 text-white/55 hover:text-white transition-colors",
        className
      )}
    >
      <ExternalLink className={iconClassName} />
    </a>
  );
}
