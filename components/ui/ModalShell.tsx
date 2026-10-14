"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface ModalShellProps {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  zIndexClass?: string;
  maxWidthClass?: string;
  alignTop?: boolean;
  panelClassName?: string;
}

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
        alignTop ? "items-start justify-center px-4 pt-[20%]" : "items-center justify-center p-4"
      )}
    >
      <div
        aria-hidden
        className="modal-scrim fixed inset-0 transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn("modal-panel relative z-10 w-full p-6", maxWidthClass, panelClassName)}
      >
        {children}
      </div>
    </div>
  );
}
