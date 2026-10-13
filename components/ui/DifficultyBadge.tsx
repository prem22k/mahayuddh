import { cn } from "@/lib/utils";
import { DifficultyBadgeNew } from "./Badge";

/**
 * Difficulty is not a color (DESIGN.md v4): word + 3-pip meter, neutral.
 */
export function difficultyBadgeClass(): string {
  return "text-text-secondary";
}

interface DifficultyBadgeProps {
  difficulty: string;
  className?: string;
}

export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  return (
    <DifficultyBadgeNew
      difficulty={difficulty}
      className={cn(className)}
    />
  );
}
