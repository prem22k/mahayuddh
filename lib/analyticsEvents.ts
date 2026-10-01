/**
 * Analytics event vocabulary (Bible §57).
 *
 * Single source of truth shared by three consumers:
 *   - lib/analytics.ts          (the client tracker)
 *   - app/api/analytics/route.ts (the server allow-list gate)
 *   - tests/smoke.test.mjs      (the funnel contract)
 *
 * Names are snake_case because the DB has a CHECK: ^[a-z0-9_]{1,60}$.
 * Adding an event here and forgetting the route used to be a silent no-op.
 */
export const ANALYTICS_EVENTS = [
  // Core battle loop
  "battle_started",
  "battle_solved",
  "battle_failed",
  // Learning loop
  "approach_written",
  "primer_read",
  "note_copied",
  "revisit_done",
  // Social loop
  "challenge_sent",
  "challenge_accepted",
  "challenge_completed",
  "challenge_reminded",
  "invite_opened",
  // Activation funnel (Step 2 done-criteria: visit -> battle -> solve -> challenge)
  "signup_from_challenge",
  "signup_completed",
  "first_battle_started",
  // Squad
  "squad_created",
  "squad_joined",
  // Shareable artifacts (Step 16, Bible §56 Loop B)
  "share_clicked",
  "battle_card_viewed",
  // Social learning (Steps 17-20)
  "revenge_started",
  "revenge_completed",
  "stuck_resolved",
  "approach_copied",
  "compare_viewed",
  "recap_generated",
  // Misc
  "sync_completed",
  "stuck_requested",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const EVENT_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENTS);

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}