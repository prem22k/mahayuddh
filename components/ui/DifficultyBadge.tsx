import { cn } from "@/lib/utils";

/**
 * Single source for difficulty pill colors (hex literals live here so
 * Tailwind's content scanner picks them up — never hide them in lib/).
 */
export function difficultyBadgeClass(difficulty: string): string {
  switch (difficulty?.toLowerCase()) {
    case "easy":
      return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/25";
    case "medium":
      return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/25";
    case "hard":
      return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/25";
    default:
      return "text-white/40";
  }
}

interface DifficultyBadgeProps {
  difficulty: string;
  className?: string;
}

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        difficultyBadgeClass(difficulty),
        className
      )}
    >
      {difficulty}
    </span>
  );
}
