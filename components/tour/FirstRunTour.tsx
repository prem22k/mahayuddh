"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { isAppPage } from "@/lib/appRoutes";
import { cn } from "@/lib/utils";
import { TOUR_STEPS, type Placement, type TourStep, type TourTarget } from "./steps";
import { TOUR_REPLAY_EVENT, setTourCompleted, tourDismissedKey } from "./replay";
import styles from "./tour.module.css";

/**
 * First-run walkthrough: coachmarks over the real shell, once per account.
 *
 * Starts right after onboarding: on the first signed-in page the setup hands
 * the visitor to, once `onboarded_at` is set and `tour_completed_at` is not,
 * so it never stacks on top of onboarding. Pages where they came to do one
 * thing (joining a squad, a challenge or share link, solving a problem) are
 * left alone; the tour waits for the next ordinary page. Finishing
 * or skipping stamps `tour_completed_at`; a session flag keeps it closed even
 * if that save fails. Profile's "Replay the tour" calls `replayTour()`.
 *
 * The dialog takes focus, traps Tab, and answers Esc (skip) and ←/→ (back,
 * next). The page underneath is dimmed and does not take clicks while the
 * tour is open. Reduced motion turns every transition off.
 */

type Found = { el: HTMLElement; target: TourTarget };
type Frame = {
  stepId: string;
  body: string;
  hole: { top: number; left: number; width: number; height: number };
  card: { top: number; left: number };
};

const HOLE_PAD = 6;
const GAP = 14;
const EDGE = 16;
/** Clear of the 64px mobile tab bar plus its safe area. */
const MOBILE_BOTTOM_EDGE = 88;

function isShown(el: Element) {
  if (el.closest('[aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

function findTarget(step: TourStep): Found | null {
  for (const target of step.targets) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(target.selector)).find(isShown);
    if (el) return { el, target };
  }
  return null;
}

function placeCard(
  r: DOMRect,
  w: number,
  h: number,
  preferred: Placement,
  vw: number,
  vh: number
): { top: number; left: number } {
  const bottomEdge = vw < 768 ? MOBILE_BOTTOM_EDGE : EDGE;
  const fits: Record<Placement, boolean> = {
    bottom: r.bottom + GAP + h <= vh - bottomEdge,
    top: r.top - GAP - h >= EDGE,
    right: r.right + GAP + w <= vw - EDGE,
    left: r.left - GAP - w >= EDGE,
  };
  const order: Placement[] = [preferred, "bottom", "top", "right", "left"];
  const side = order.find((p) => fits[p]);

  let top: number;
  let left: number;
  if (side === "bottom" || side === "top") {
    top = side === "bottom" ? r.bottom + GAP : r.top - GAP - h;
    left = r.left + r.width / 2 - w / 2;
  } else if (side === "right" || side === "left") {
    left = side === "right" ? r.right + GAP : r.left - GAP - w;
    top = r.top + r.height / 2 - h / 2;
  } else {
    // A target taller than the room around it (the Arena Pass on a phone):
    // pin the card to whichever edge the target leaves free.
    left = (vw - w) / 2;
    top = r.top + r.height / 2 > vh / 2 ? EDGE : vh - bottomEdge - h;
  }

  return {
    left: Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - w - EDGE)),
    top: Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - bottomEdge - h)),
  };
}

/**
 * Pages the tour may open on. Not the setup, auth or public pages, and not a
 * page the visitor arrived at to finish one task: a squad invite, a
 * challenge, a shared proof or approach, a profile link, or a problem they
 * are solving. The tour picks up on the next page they open.
 */
export function tourCanStartOn(path: string): boolean {
  if (!isAppPage(path)) return false;
  return !(
    path === "/onboarding" ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path === "/welcome" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/offline" ||
    path.startsWith("/squad/join/") ||
    /^\/(c|b|a|u)\//.test(path) ||
    /^\/practice\/[^/]+/.test(path)
  );
}

const noopSubscribe = () => () => {};

function readDismissed(userId: string | undefined) {
  if (!userId) return false;
  try {
    return sessionStorage.getItem(tourDismissedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FirstRunTour() {
  const { user, profile, refreshProfile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [index, setIndex] = useState<number | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [closedNow, setClosedNow] = useState(false);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const storedDismissed = useSyncExternalStore(
    noopSubscribe,
    () => readDismissed(user?.id),
    () => false
  );

  const eligible =
    !!user &&
    tourCanStartOn(pathname ?? "") &&
    !!profile?.onboarded_at &&
    !profile?.tour_completed_at &&
    !closedNow &&
    !storedDismissed;
  const running = eligible && index !== null;
  const step = running ? TOUR_STEPS[index] : null;

  // Start once there is something to point at. On /home that means the Arena
  // Pass (the page loads behind a skeleton); elsewhere the shell's nav is
  // enough. After ~10s start anyway; a missing stop is skipped.
  const onHome = pathname === "/home";
  useEffect(() => {
    if (!eligible || index !== null) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const ready = onHome
        ? !!document.querySelector("main .pass:not([aria-hidden] .pass)") && !!findTarget(TOUR_STEPS[0])
        : TOUR_STEPS.some((s) => findTarget(s));
      if (ready || tries >= 40) {
        window.clearInterval(id);
        returnFocus.current = document.activeElement as HTMLElement | null;
        direction.current = 1;
        setIndex(0);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [eligible, index, onHome]);

  const close = useCallback(() => {
    setIndex(null);
    setFrame(null);
    setClosedNow(true);
    if (user) {
      try {
        sessionStorage.setItem(tourDismissedKey(user.id), "1");
      } catch {
        // Storage blocked: the in-memory flag still holds for this visit.
      }
    }
    setTourCompleted(true)
      .then(() => refreshProfile())
      .catch((err) => console.warn("[tour] could not save completion:", err));
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  }, [user, refreshProfile]);

  const go = useCallback(
    (delta: 1 | -1) => {
      if (index === null) return;
      const next = index + delta;
      if (next < 0) return;
      if (next >= TOUR_STEPS.length) {
        close();
        return;
      }
      direction.current = delta;
      setIndex(next);
    },
    [index, close]
  );

  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // Follow the current target every frame while the tour is open: smooth
  // scrolling, late layout and window resizes all move it.
  useEffect(() => {
    if (!step) return;
    const found = findTarget(step);
    let raf = 0;

    if (!found) {
      // Nothing to point at on this layout: move on in the same direction,
      // or close if the tour has run out of stops.
      raf = requestAnimationFrame(() => {
        const next = (index ?? 0) + direction.current;
        if (next < 0 || next >= TOUR_STEPS.length) closeRef.current();
        else setIndex(next);
      });
      return () => cancelAnimationFrame(raf);
    }

    if (found.target.scroll) {
      found.el.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }

    let last = "";
    const tick = () => {
      const r = found.el.getBoundingClientRect();
      const card = cardRef.current;
      const w = card?.offsetWidth ?? 360;
      const h = card?.offsetHeight ?? 220;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const key = [r.top, r.left, r.width, r.height, w, h, vw, vh].map(Math.round).join(",");
      if (key !== last) {
        last = key;
        setFrame({
          stepId: step.id,
          body: found.target.body ?? step.body,
          // Padded, but kept on screen: a tab at the very edge of a phone
          // would otherwise push the outline past it.
          hole: (() => {
            const left = Math.max(2, r.left - HOLE_PAD);
            const top = Math.max(2, r.top - HOLE_PAD);
            const right = Math.min(vw - 2, r.right + HOLE_PAD);
            const bottom = Math.min(vh - 2, r.bottom + HOLE_PAD);
            return { top, left, width: right - left, height: bottom - top };
          })(),
          card: placeCard(r, w, h, found.target.placement, vw, vh),
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, index]);

  // Each stop takes focus once its card is placed (a hidden card can't take
  // focus), so its title and body are read out.
  const placedStep = frame?.stepId ?? null;
  useEffect(() => {
    if (step && placedStep === step.id) cardRef.current?.focus({ preventScroll: true });
  }, [step, placedStep]);

  // Keyboard: Esc skips, arrows move, Tab stays inside the card.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const card = cardRef.current;
      if (!card) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Tab") {
        const focusable = Array.from(card.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || active === card)) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [running, close, go]);

  // "Replay the tour" (profile): refresh the cleared flag, then go home.
  const refreshRef = useRef(refreshProfile);
  useEffect(() => {
    refreshRef.current = refreshProfile;
  });
  useEffect(() => {
    const onReplay = (e: Event) => {
      e.preventDefault();
      setClosedNow(false);
      setIndex(null);
      setFrame(null);
      void refreshRef.current().then(() => router.push("/home"));
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, [router]);

  if (!step || typeof document === "undefined") return null;

  // The hole glides from the last stop to the next; the card waits until it
  // has been measured for this stop, then appears in place.
  const hole = frame?.hole ?? null;
  const shown = frame?.stepId === step.id ? frame : null;
  const at = index ?? 0;
  const isLast = at === TOUR_STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[300]" data-tour-root>
      {/* Blocks the page underneath; the hole is visual only. */}
      <div className="absolute inset-0" aria-hidden onMouseDown={(e) => e.preventDefault()} />

      {hole ? (
        <div
          aria-hidden
          className={cn("pointer-events-none fixed rounded-lg", styles.scrimIn, styles.glide)}
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 1px var(--color-hairline-strong), 0 0 0 9999px rgba(5, 6, 8, 0.72)",
          }}
        />
      ) : (
        <div aria-hidden className={cn("pointer-events-none fixed inset-0 bg-[rgba(5,6,8,0.72)]", styles.scrimIn)} />
      )}

      <div
        key={step.id}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cn(
          "fixed w-[min(360px,calc(100vw-32px))] rounded-lg border border-hairline-strong bg-surface-raised p-5 shadow-overlay outline-none",
          shown ? styles.cardIn : "invisible"
        )}
        style={shown ? { top: shown.card.top, left: shown.card.left } : { top: 0, left: 0 }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs font-medium text-text-tertiary tnum">
            {at + 1} of {TOUR_STEPS.length}
          </p>
          <span className="flex items-center gap-1" aria-hidden>
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1 rounded-full transition-[width,background-color] duration-200",
                  i === at ? "w-4 bg-text-primary" : i < at ? "w-1.5 bg-text-secondary" : "w-1.5 bg-hairline-strong"
                )}
              />
            ))}
          </span>
        </div>

        <h2 id={titleId} className="mt-3 text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm leading-6 text-text-secondary">
          {shown?.body ?? step.body}
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={close}
            className="-ml-2 inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-text-tertiary transition-colors duration-150 hover:bg-surface-overlay hover:text-text-primary"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {at > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="inline-flex h-9 items-center rounded-md border border-hairline-strong bg-surface-overlay px-3 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-[#272830]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-hover active:bg-primary-pressed"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
