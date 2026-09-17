import { cn } from "@/lib/utils";

const SIZES = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
} as const;

const TONES = {
  /** Brand spinner on dark surfaces (page loaders). */
  accent: "border-white/10 border-t-[#fa586a]",
  /** Brand spinner on lighter/raised surfaces. */
  soft: "border-white/20 border-t-[#fa586a]",
  /** White spinner on brand/colored backgrounds. */
  inverse: "border-white/30 border-t-white",
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
