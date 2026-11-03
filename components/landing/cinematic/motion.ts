"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * One passive scroll listener for the whole landing. Each registered element
 * gets a `--p` custom property running 0 → 1 as its top edge travels from
 * `start` to `end` (fractions of the viewport height, measured from the top).
 *
 * CSS reads `--p`; nothing re-renders on scroll. With reduced motion nothing
 * registers, `--p` keeps its CSS default of 1, and the page renders final.
 */

type Entry = {
  el: HTMLElement;
  start: number;
  end: number;
  last: number;
  name: string;
  center: boolean;
};

const entries = new Set<Entry>();
let frame = 0;
let listening = false;

function measure() {
  frame = 0;
  const vh = window.innerHeight || 1;
  for (const e of entries) {
    const r = e.el.getBoundingClientRect();
    const y = e.center ? r.top + r.height / 2 : r.top;
    const raw = (e.start * vh - y) / ((e.start - e.end) * vh);
    const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    if (Math.abs(p - e.last) > 0.002) {
      e.last = p;
      e.el.style.setProperty(e.name, p.toFixed(3));
    }
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure);
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

function unlistenIfIdle() {
  if (entries.size || !listening) return;
  listening = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

const noopSubscribe = () => () => {};

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * `anchor: "center"` measures the element's middle instead of its top, so a
 * tall section can report where it sits in the viewport (0.5 = centered).
 */
export function useScrollProgress<T extends HTMLElement>(
  start = 0.9,
  end = 0.45,
  name = "--p",
  anchor: "top" | "center" = "top"
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const entry: Entry = { el, start, end, last: -1, name, center: anchor === "center" };
    entries.add(entry);
    listen();
    schedule();
    return () => {
      entries.delete(entry);
      el.style.removeProperty(name);
      unlistenIfIdle();
    };
  }, [start, end, name, anchor]);
  return ref;
}

/** False on the server and under reduced motion: render the final state. */
export function useMotionAllowed() {
  return useSyncExternalStore(
    noopSubscribe,
    () => !prefersReducedMotion(),
    () => false
  );
}

/** Runs `onEnter` once, the first time the element is mostly on screen. */
export function useFirstSight<T extends HTMLElement>(onEnter: () => void, threshold = 0.6) {
  const ref = useRef<T>(null);
  const cb = useRef(onEnter);
  useEffect(() => {
    cb.current = onEnter;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          cb.current();
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/* ── Today, client-side only ───────────────────────────────────
   The page is static, so a server-rendered date would freeze at build time.
   The server snapshot is null and callers render a neutral placeholder. */

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function useToday(): Date | null {
  const key = useSyncExternalStore(noopSubscribe, todayKey, () => null);
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m, d);
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** 03 NOV 2026 */
export function serialDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 20 OCT */
export function shortDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export function daysAgo(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  return out;
}

/** mm:ss, or h:mm:ss once an hour has passed. */
export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 4m 43s */
export function spoken(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return sec === 0 ? `${m}m` : `${m}m ${sec}s`;
}
