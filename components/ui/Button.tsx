"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "full";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium leading-5 transition-colors focus-visible:outline-none disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed disabled:bg-surface-overlay disabled:text-text-disabled h-10 px-4",
  secondary:
    "bg-surface-overlay text-text-primary hover:bg-[#272830] disabled:text-text-disabled h-10 px-4",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary disabled:text-text-disabled h-10 px-3",
  danger:
    "bg-error-tint text-error hover:brightness-110 disabled:text-text-disabled h-10 px-4",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        base,
        variants[variant],
        size === "lg" && "h-12 px-6",
        size === "full" && "w-full h-10 px-4",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-label="Loading"
        />
      ) : (
        children
      )}
    </button>
  );
}
