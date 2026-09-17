"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface ModalShellProps {
  /** Accessible name for the dialog. */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  zIndexClass?: string;
  maxWidthClass?: string;
  /** Top-anchored (command-palette style) instead of centered. */
  alignTop?: boolean;
  panelClassName?: string;
}

/**
 * Shared modal chrome: overlay + backdrop + dialog semantics + Escape.
 * Per-modal visuals go in panelClassName (merged, so overrides win).
 */
export function ModalShell({
  label,
  onClose,
  children,
  zIndexClass = "z-50",
  maxWidthClass = "max-w-lg",
  alignTop = false,
  panelClassName,
}: ModalShellProps) {
  useEscapeKey(true, onClose);

  return (
    <div
      className={cn(
        "fixed inset-0 flex select-none overflow-y-auto",
        zIndexClass,
        alignTop ? "items-start justify-center px-4 pt-20" : "items-center justify-center p-4"
      )}
    >
      <div
        aria-hidden
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "relative w-full bg-[#1c1c1e] border border-white/[0.1] rounded-3xl z-10 animate-in fade-in zoom-in-95",
          maxWidthClass,
          panelClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
