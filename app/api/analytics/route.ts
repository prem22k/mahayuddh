import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  resolveUser,
} from "@/lib/supabase/service";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";
import { rateLimit, rateLimitKey, RATE_RULES, clientIp } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";

// Single source of truth, shared with lib/analytics.ts and the smoke tests —
// a hand-copied list here silently dropped newly added events.
const ALLOWED = new Set<string>(ANALYTICS_EVENTS);

const MAX_BATCH = 100;
const MAX_PROPS_BYTES = 1024;

function sanitizeProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) continue;
    if (value === null) {
      out[key] = null;
      continue;
    }
    // Numbers, booleans and short strings only: no PII-shaped blobs, no bodies.
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string") {
      out[key] = value.slice(0, 200);
    }
    if (JSON.stringify(out).length > MAX_PROPS_BYTES) break;
  }
  return out;
}

// POST /api/analytics — batch sink for the client funnel.
// Written with the service key (bypasses RLS) after sanitising every field, so
// anonymous top-of-funnel events can be recorded without an open INSERT policy.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  // Anonymous is allowed: a logged-out visitor opening /c/[id] is exactly the
  // top of Loop A, and dropping that event would hide the funnel's entry point.
  //
  // That makes this the cheapest endpoint in the app to flood, and it writes
  // with the service key, so the cap is per-caller with the IP as the subject
  // whenever there is no session. Every field is sanitised below, but a row per
  // request is still a row per request.
  const user = await resolveUser(extractBearerToken(request));
  const userId = user?.id ?? null;

  const limit = rateLimit({
    ...RATE_RULES.analytics,
    key: rateLimitKey("analytics", { userId, ip: clientIp(request) }),
  });
  if (!limit.ok) {
    return NextResponse.json(
      { accepted: 0 },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = await readJsonBounded<{ events?: unknown }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const events: unknown[] = Array.isArray(parsed.value?.events) ? parsed.value.events : [];
  if (events.length === 0) {
    return NextResponse.json({ accepted: 0 });
  }

  const rows: Array<{
    user_id: string | null;
    event: string;
    props: Record<string, unknown>;
    occurred_at: string;
  }> = [];

  for (const raw of events.slice(0, MAX_BATCH)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { event?: unknown; props?: unknown; at?: unknown };
    if (typeof candidate.event !== "string" || !ALLOWED.has(candidate.event)) continue;
    rows.push({
      user_id: userId,
      event: candidate.event,
      props: sanitizeProps(candidate.props),
      // Trust the client's clock only within a sane window; otherwise stamp now.
      occurred_at:
        typeof candidate.at === "string" && isSaneTimestamp(candidate.at)
          ? candidate.at
          : new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ accepted: 0 });
  }

  const { error } = await supabase.from("analytics_events").insert(rows);
  if (error) {
    return NextResponse.json({ error: "Couldn't record events" }, { status: 500 });
  }
  return NextResponse.json({ accepted: rows.length });
}

function isSaneTimestamp(value?: string): boolean {
  if (!value) return false;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  const now = Date.now();
  const aYear = 365 * 24 * 60 * 60 * 1000;
  // Reject anything in the future or older than a year: clocks drift, but not
  // this far, and a bad stamp would poison the funnel.
  return ts <= now + 60_000 && ts >= now - aYear;
}