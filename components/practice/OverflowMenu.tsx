"use client";

import React, { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OverflowItem {
  label: string;
  onSelect: () => void;
}

/**
 * The problem header's ⋯ button: a small menu for the secondary status
 * actions (mark solved / attempted) so the header keeps one row of buttons.
 * Closes on outside click, Escape, and after a choice.
 */
export function OverflowMenu({
  items,
  label = "More actions",
  className,
}: {
  items: OverflowItem[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-md border border-hairline bg-surface-raised text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary md:h-10 md:w-10 md:bg-transparent",
          className
        )}
      >
        <Ellipsis className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="popover-panel absolute right-0 top-full z-30 mt-2 min-w-[180px] p-1"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-9"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
