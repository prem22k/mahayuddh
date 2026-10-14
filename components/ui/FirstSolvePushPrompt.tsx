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
    <section className="card space-y-2" aria-label="Turn on push alerts">
      <p className="text-sm font-medium leading-5 text-text-primary">
        Solved your first battle. Want the next challenge to find you?
      </p>
      <p className="text-sm leading-6 text-text-secondary">
        Turn on push alerts and your squad&apos;s challenges arrive on your phone.
        The bell up top can switch them off any time.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => void requestPushPermission().then(dismiss)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover"
        >
          <BellRing className="h-4 w-4" strokeWidth={1.5} />
          Turn on alerts
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
