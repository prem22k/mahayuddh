import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getDifficultyColor(difficulty: "Easy" | "Medium" | "Hard" | string) {
  switch (difficulty?.toLowerCase()) {
    case "easy":
      return "text-difficulty-easy bg-difficulty-easy/10 border-difficulty-easy/20";
    case "medium":
      return "text-difficulty-medium bg-difficulty-medium/10 border-difficulty-medium/20";
    case "hard":
      return "text-difficulty-hard bg-difficulty-hard/10 border-difficulty-hard/20";
    default:
      return "text-txt-secondary bg-surface-raised border-border-subtle";
  }
}
