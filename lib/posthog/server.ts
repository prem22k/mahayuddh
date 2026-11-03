import { PostHog } from "posthog-node";
import { posthogConfig } from "./config";
import { scrub } from "./scrub";

/**
 * Server-side error reporting (instrumentation.ts onRequestError, API
 * routes). One client per server process; flushes every event immediately
 * because serverless functions can freeze right after responding.
 */
let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const cfg = posthogConfig();
  client = cfg ? new PostHog(cfg.token, { host: cfg.host, flushAt: 1, flushInterval: 0 }) : null;
  return client;
}

/** Report a server error. Never throws. */
export async function reportServerError(error: unknown, properties: Record<string, unknown> = {}): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    err.message = scrub(err.message);
    if (err.stack) err.stack = scrub(err.stack);
    ph.captureException(err, "server", scrub({ ...properties, $process_person_profile: false }));
    await ph.flush();
  } catch {
    // Reporting must never turn into a second error.
  }
}
