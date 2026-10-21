"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { pushPermissionState, requestPushPermission } from "@/lib/pushPermission";

/**
 * First-solve push prompt (Wave D growth).
 *
 * Product copy only: it appears once, after a solve, and borrows the bell's
 * permission flow (requestPushPermission) rather than building its own. The
 * grant itself is already counted as notification_push_toggled, so this
 * component fires no analytics of its own.
 */

const SEEN_KEY = "mahayuddh.first_solve_push_prompt";

export function FirstSolvePushPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY) && pushPermissionState() === "default") {
        setVisible(true);
      }
    } catch {
      // Storage unavailable: stay hidden rather than nagging every visit.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:flex-row sm:items-center md:p-5"
      aria-label="Turn on push alerts"
    >
      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-well text-primary sm:flex">
        <BellRing className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 text-text-primary">
          Solved your first battle. Want the next challenge to find you?
        </p>
        <p className="mt-0.5 text-xs leading-[18px] text-text-secondary">
          Turn on push alerts and your squad&apos;s challenges arrive on your phone.
          The bell up top can switch them off any time.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void requestPushPermission().then(dismiss)}
          className="inline-flex h-11 items-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-3 text-xs font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay md:h-9"
        >
          <BellRing className="h-3.5 w-3.5 sm:hidden" strokeWidth={1.5} aria-hidden />
          Turn on alerts
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-11 items-center rounded-md px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-9"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
