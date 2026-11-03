import posthog from "posthog-js";
import { posthogConfig } from "@/lib/posthog/config";
import { scrub } from "@/lib/posthog/scrub";

/**
 * Browser error tracking (Next.js runs this before the app hydrates).
 *
 * Error tracking only: uncaught exceptions and unhandled rejections are
 * captured; clicks, page views and session recordings are NOT (the app has
 * its own analytics, and recordings would capture people's code and notes).
 * Memory persistence: no cookie or localStorage entry, so nothing to consent
 * to. Every event passes through scrub() so no access token can leave.
 * Without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN / _HOST this does nothing.
 */
const cfg = posthogConfig();
if (cfg) {
  posthog.init(cfg.token, {
    api_host: cfg.host,
    defaults: "2026-05-30",
    capture_exceptions: true,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    persistence: "memory",
    person_profiles: "identified_only",
    before_send: (event) => (event ? { ...event, properties: scrub(event.properties) } : event),
  });
}
