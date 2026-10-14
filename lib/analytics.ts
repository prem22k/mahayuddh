/**
 * Analytics wrapper (Phase 0 Step 2, Bible §57).
 *
 * Contract: analytics must NEVER break a product flow, and it must never be
 * silently swallowed. So:
 *   - `track()` queues in memory + localStorage (survives a reload mid-session)
 *   - a timer + pagehide flush POST the batch to /api/analytics
 *   - the route writes to `analytics_events` with the service key
 *   - failures keep the batch in localStorage for the next attempt
 *
 * No vendor lock-in: swap the route body for Postthog without touching call sites.
 *
 * Events (snake_case, Bible §57):
 *   battle_started, battle_solved, battle_failed, approach_written,
 *   challenge_sent, challenge_accepted, challenge_completed, primer_read,
 *   note_copied, revisit_done, invite_opened, signup_from_challenge,
 *   signup_completed, first_battle_started, squad_created, squad_joined,
 *   stuck_requested, sync_completed.
 */

export type { AnalyticsEvent } from "@/lib/analyticsEvents";
import type { AnalyticsEvent } from "@/lib/analyticsEvents";

export interface AnalyticsEntry {
  event: AnalyticsEvent;
  props?: Record<string, unknown>;
  at: string;
}

const QUEUE_KEY = "mahayuddh_analytics_queue";
const MAX_QUEUE = 200;
const FLUSH_INTERVAL_MS = 15_000;

function readQueue(): AnalyticsEntry[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnalyticsEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: AnalyticsEntry[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Quota or private mode: analytics is best-effort by contract.
  }
}

let timerStarted = false;

function ensureFlushTimer(): void {
  if (timerStarted || typeof window === "undefined") return;
  timerStarted = true;
  window.setInterval(() => {
    // Skip the flush while the tab is hidden: the queue persists in
    // localStorage and the pagehide listener below still lands it on unload.
    if (document.visibilityState !== "visible") return;
    void flushAnalytics();
  }, FLUSH_INTERVAL_MS);
  // sendBeacon survives page unload; fetch may be cancelled mid-navigation.
  window.addEventListener("pagehide", () => {
    void flushAnalytics();
  });
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  const entry: AnalyticsEntry = { event, props, at: new Date().toISOString() };
  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", entry);
  }
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  ensureFlushTimer();
}

/**
 * POST the queued batch. Keeps entries on failure so nothing is lost, and
 * returns whether the batch landed (used by tests).
 */
export async function flushAnalytics(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const queue = readQueue();
  if (queue.length === 0) return true;

  try {
    const res = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: queue }),
      keepalive: true,
    });
    if (!res.ok) return false;
    writeQueue([]);
    return true;
  } catch {
    return false;
  }
}

/** Debug/triage helper. */
export function readAnalyticsQueue(): AnalyticsEntry[] {
  return readQueue();
}

// Attribution storage lives in lib/shareSource.ts: the expiry and one-shot
// rules there are worth testing, and this module's `@/` imports keep it out of
// reach of the plain node test runner. Re-exported so call sites have one
// analytics entry point.
export { rememberSource, consumeSource, peekSource, isValidSlug } from "@/lib/shareSource";
