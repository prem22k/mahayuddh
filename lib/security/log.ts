/**
 * Structured security-event logging.
 *
 * One line of JSON per event, on a stable `security` key, so a log pipeline can
 * alert on `auth.denied` without parsing prose. Deliberately tiny and
 * dependency-free: it has to be callable from the edge middleware and from Node
 * route handlers alike.
 *
 * The redaction is the point. A security log is the one place where people are
 * tempted to paste the offending request in full "just to debug", and that turns
 * an audit trail into a credential store. Anything whose key looks like a
 * secret is replaced before the line is built, not after.
 *
 * Never log: passwords, session or reset tokens, API keys, `Authorization`
 * headers, cookies, push subscription keys, or a provider's raw error body.
 */

const REDACTED = "[redacted]";

/**
 * Key patterns that must never reach a log line.
 *
 * `id` is deliberately absent: a user id is the thing you need in an audit
 * trail, and it is not a credential. `token` matches `reset_token`,
 * `access_token`, `x-mahayuddh-token` and `contest_reminder_token`, and it also
 * catches a field literally named `token` — which is why the one safe caller is
 * `logSecurityEvent(..., { detail: "token rejected" })` rather than
 * `{ token: "rejected" }`.
 */
const SECRET_KEY_PATTERN =
  /(pass(word|phrase)?|secret|token|api[-_]?key|authorization|auth[-_]?header|cookie|session[-_]?id|refresh|otp|credential|private[-_]?key|p256dh|\bauth\b)/i;

/** Anything longer than this is a payload someone pasted in, not a log field. */
const MAX_VALUE_CHARS = 200;

export type SecurityEventName =
  | "auth.denied"
  | "authz.denied"
  | "csrf.rejected"
  | "rate_limit.exceeded"
  | "input.rejected"
  | "ssrf.rejected"
  | "cron.denied"
  | "oversize_request"
  | "csrf.bearer_bypass";

/** Keys that are safe to pass through even though they match the pattern. */
const SAFE_KEYS = new Set(["detail", "reason", "actor_id", "detail_kind"]);

function redactValue(key: string, value: unknown): unknown {
  if (!SAFE_KEYS.has(key) && SECRET_KEY_PATTERN.test(key)) return REDACTED;
  if (typeof value === "string") {
    return value.length > MAX_VALUE_CHARS ? `${value.slice(0, MAX_VALUE_CHARS)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value === "object") return "[object]";
  return String(value);
}

export function redactForLog(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export function formatSecurityEvent(
  event: SecurityEventName | string,
  fields: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    security: event,
    at: new Date().toISOString(),
    ...redactForLog(fields),
  });
}

/**
 * Emit one security event.
 *
 * `console.warn` rather than `console.error` so it lands on stderr without
 * looking like a crash in the platform's error dashboards — these are expected
 * occurrences, not faults.
 */
export function logSecurityEvent(
  event: SecurityEventName | string,
  fields: Record<string, unknown> = {}
): void {
  try {
    console.warn(formatSecurityEvent(event, fields));
  } catch {
    // A logger that throws inside a request handler is a worse outcome than a
    // dropped log line.
  }
}