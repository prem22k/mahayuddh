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
  // §56 Loop B, the conversion half. share_clicked is the numerator's
  // numerator; without this, sharing is only measurable as far as the click.
  "share_signup",
  "battle_card_viewed",
  // Social learning (Steps 17-20)
  "revenge_started",
  "revenge_completed",
  "stuck_resolved",
  "approach_copied",
  "compare_viewed",
  "recap_generated",
  // Recommendation engine (Step 24). The accept rate is §24's metric, and it
  // needs the decision to be recorded independently of recommendation_log so
  // the funnel query does not have to read somebody's own rows.
  "recommendation_shown",
  "recommendation_decided",
  // Loop D squad from referral (Step 26). invite_opened and squad_joined are
  // server-side; this is the outbound half the member controls.
  "invite_link_copied",
  // An account created while arriving on an invite link. Distinct from
  // invite_opened (a click) and referral_join_completed (a membership).
  "invite_signup",
  "referral_join_completed",
  // Loop C knowledge (Step 26, §47/§56). Whether authors see impact at all is
  // the question Loop C rests on, so the panel view itself is the signal.
  "impact_panel_opened",
  "content_published",
  // AI (Step 25, Bible §45). outcome is the interesting property: a rising
  // refused/rate_limited count means the guardrails are holding, not that
  // something broke.
  "ai_assistant_asked",
  "ai_feature_refused",
  // Composer (Step 21). Which tile somebody uses is the only signal that says
  // whether the structured composer is worth having at all.
  "composer_opened",
  "composer_posted",
  // Notifications (Step 23, Bible §37). §37's metric is CTR by kind, so the
  // three events that make a rate computable are named separately: delivered,
  // opened, clicked.
  "notification_delivered",
  "notification_bell_opened",
  "notification_clicked",
  // Push permission now lives inside the bell rather than in a second control
  // beside it, so the grant rate is measurable from the same surface.
  "notification_push_toggled",
  "notification_push_manage_opened",
  // Feed (Step 21, Bible §19/§51). Useful-action rate per feed view is the
  // Step 21 metric, so the denominators and the actions are both named.
  // feed_view is the DENOMINATOR (a feed was looked at); feed_action is the
  // NUMERATOR (somebody acted on something in it). Keeping them separate is the
  // whole point — reusing one name for both would make the rate always 1.
  "feed_view",
  "feed_action",
  "discuss_posted",
  "feed_reported",
  "feed_blocked",
  "user_followed",
  "user_unfollowed",
  // Misc
  "sync_completed",
  "stuck_requested",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const EVENT_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENTS);

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}