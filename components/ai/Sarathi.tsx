import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sarathi: the practice guide's face in the UI.
 *
 * In the Mahabharata, the great war Mahayuddh is named for, Krishna does not
 * fight for Arjuna; he is his sarathi, the charioteer who steers. That is the
 * guide's whole contract here: it steers, the developer fights. The mark is a
 * chariot wheel.
 *
 * The UI never names the model or service behind the guide; it is Sarathi.
 * (lib/ai/policy.ts GUIDE_NAME is the same name for server-side copy.)
 */

export const GUIDE_NAME = "Sarathi";

export function SarathiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-4 w-4", className)}>
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={angle}
          x1="12"
          y1="3"
          x2="12"
          y2="21"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
    </svg>
  );
}

/** Round gold badge with the wheel, for headers and empty states. */
export function SarathiAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary-tint text-primary",
        size === "md" ? "h-9 w-9" : "h-7 w-7"
      )}
    >
      <SarathiMark className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
    </span>
  );
}

export function SarathiHeader({ title, blurb }: { title: ReactNode; blurb?: ReactNode }) {
  return (
    <header className="flex items-start gap-3">
      <SarathiAvatar />
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold leading-5 text-text-primary">
          {title}
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-primary">
            {GUIDE_NAME}
          </span>
        </p>
        {blurb && <p className="text-xs leading-[18px] text-text-secondary">{blurb}</p>}
      </div>
    </header>
  );
}
