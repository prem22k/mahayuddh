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
  /**
   * "sheet" docks the panel to the bottom edge below md (full width, top
   * corners only, a grab handle) and is the centered modal from md up.
   * Defaults to the centered modal everywhere.
   */
  variant?: "modal" | "sheet";
}

export function ModalShell({
  label,
  onClose,
  children,
  // Above the shell chrome: the mobile tab bar and solve dock sit at z-100,
  // and the dock's own popovers go up to z-160.
  zIndexClass = "z-[300]",
  maxWidthClass = "max-w-lg",
  alignTop = false,
  panelClassName,
  variant = "modal",
}: ModalShellProps) {
  useEscapeKey(true, onClose);
  const sheet = variant === "sheet";

  return (
    <div
      className={cn(
        "fixed inset-0 flex select-none overflow-y-auto",
        zIndexClass,
        sheet
          ? "items-end justify-center p-0 md:items-center md:p-4"
          : alignTop
            ? "items-start justify-center px-4 pt-[20%]"
            : "items-center justify-center p-4"
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
        className={cn(
          "modal-panel relative z-10 w-full p-6",
          maxWidthClass,
          sheet && "max-md:max-w-none max-md:rounded-b-none max-md:border-b-0",
          panelClassName
        )}
      >
        {sheet && (
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-text-tertiary/40 md:hidden"
          />
        )}
        {children}
      </div>
    </div>
  );
}
