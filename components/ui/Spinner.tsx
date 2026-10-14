import { cn } from "@/lib/utils";

const SIZES = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
} as const;

const TONES = {
  /** Gold spinner on dark surfaces (page loaders). */
  accent: "border-surface-overlay border-t-primary",
  /** Gold spinner on lighter/raised surfaces. */
  soft: "border-surface-overlay border-t-primary",
  /** Dark spinner on gold backgrounds. */
  inverse: "border-on-primary/30 border-t-on-primary",
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}

export function Spinner({ size = "md", tone = "accent", className }: SpinnerProps) {
  return (
    <div
      aria-hidden
      className={cn("animate-spin rounded-full border-2", SIZES[size], TONES[tone], className)}
    />
  );
}
