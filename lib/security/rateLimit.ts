/**
 * In-process fixed-window rate limiter.
 *
 * Honest about what it is: a per-instance, in-memory limiter. On a single Node
 * process it is exact. Across N serverless instances it is N times as generous,
 * and it resets on every cold start. That is a real limitation and it is stated
 * here rather than implied away by the word "rate limit".
 *
 * It is still the right layer for this app because the abuse it stops is
 * per-account and burst-shaped — a script hammering /api/notify or burning AI
 * budget — and a script has to keep its connection somewhere. Anything that needs
 * a *global* guarantee (per-email outbound send caps, per-IP credential
 * stuffing across accounts) belongs in Postgres, and `sync_rate_limits` is
 * already exactly that for the LeetCode sync path.
 *
 * Fixed window rather than sliding window on purpose: the window boundary is the
 * burst shape an attacker actually exploits, and a sliding window needs a
 * timestamp per hit. Fail closed — an over-limit request is refused, never
 * silently passed.
 *
 * Alias-free, no node built-ins: usable from the edge middleware too.
 */

/**
 * The two numbers that make a limit. Split from `RateLimitRule` so `RATE_RULES`
 * can declare budgets without inventing a bucket key each — the key is derived
 * per caller at the call site by `rateLimitKey`.
 */
export interface RateLimitBudget {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitRule extends RateLimitBudget {
  /** Identifies the bucket: route + caller. */
  key: string;
}

export interface RateLimitVerdict {
  ok: boolean;
  /** Hits left in the current window. */
  remaining: number;
  /** Seconds until the window frees up. Only meaningful when ok is false. */
  retryAfterSec: number;
  limit: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Hard cap on tracked buckets.
 *
 * The key space includes attacker-controlled input (an IP, a user id), so an
 * unbounded map is itself a memory-exhaustion vector: mint a new key per request
 * and never let a window expire. Past this many entries the oldest half is
 * dropped, which degrades toward "some keys are untracked" rather than toward
 * "the process dies".
 */
const MAX_BUCKETS = 10_000;

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const excess = buckets.size - Math.floor(MAX_BUCKETS / 2);
    let dropped = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

export function rateLimit(rule: RateLimitRule, now: number = Date.now()): RateLimitVerdict {
  const { key, limit, windowMs } = rule;
  // A rule with no budget is a configuration bug, not an open door.
  if (limit <= 0 || windowMs <= 0) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil(windowMs / 1000) || 1, limit };
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) prune(now);
    return { ok: true, remaining: limit - 1, retryAfterSec: 0, limit };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      limit,
    };
  }

  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0, limit };
}

/** Test seam, and the escape hatch for a route that must not inherit a throttle. */
export function resetRateLimits(): void {
  buckets.clear();
}

// ── Named rules ─────────────────────────────────────────────────────────────
// One place for every budget, so "what can an attacker do per hour" is a
// readable list rather than a number buried in each route handler.

const MINUTE = 60_000;
const HOUR = 60 * 60_000;

export const RATE_RULES = {
  /**
   * /api/notify is a free-text push to an arbitrary user id for any
   * authenticated caller. Without a cap it is a spam cannon pointed at a
   * stranger's phone. Deliberately tight: a real product action is a handful a
   * day.
   */
  notify: { limit: 30, windowMs: HOUR },
  /** Squad creation is one-per-person-per-life, not one-per-minute. */
  squadCreate: { limit: 3, windowMs: HOUR },
  /**
   * Invite codes are 8 characters over a 30-symbol alphabet, so guessing is not
   * the risk — hammering the endpoint is. Also the outbound-notification path.
   */
  squadJoin: { limit: 20, windowMs: 10 * MINUTE },
  /**
   * Per-address ceiling for the same route, and deliberately several times
   * looser than the per-account one.
   *
   * An address is not a person: a university, an office or a mobile carrier
   * puts hundreds of real users behind one, and joining a squad is a one-time
   * action per person. Setting this equal to the account cap would have blocked
   * legitimate joins the first time a handful of colleagues used the product on
   * the same wifi — a self-inflicted denial of service. It exists to catch an
   * attacker rotating throwaway accounts from one host, which takes hundreds of
   * attempts, not twenty.
   */
  squadJoinByIp: { limit: 120, windowMs: 10 * MINUTE },
  /** The 1-click LeetCode import: already cooled down in Postgres, capped again here. */
  syncImport: { limit: 30, windowMs: HOUR },
  /**
   * AI. The per-squad hourly budget in Postgres is the product-level cap; this
   * is the per-account ceiling that stops one member cycling through squad ids.
   */
  aiCall: { limit: 60, windowMs: HOUR },
  /** Push subscribe/unsubscribe churn against the push services themselves. */
  push: { limit: 60, windowMs: HOUR },
  /** Analytics batch sink: unauthenticated by design, so the cheapest DoS to stop. */
  analytics: { limit: 60, windowMs: MINUTE },
  /**
   * Catch-all for every other state-changing API call, keyed per caller. Sized
   * well above real usage so no honest flow is ever throttled by accident.
   */
  write: { limit: 300, windowMs: 10 * MINUTE },
} as const satisfies Record<string, RateLimitBudget>;

export type RateLimitRuleName = keyof typeof RATE_RULES;

/**
 * Bucket key.
 *
 * Caller identity is part of the key, not the whole of it: an unauthenticated
 * flood has no user id to work with, so the client address is the fallback.
 */
export function rateLimitKey(
  rule: RateLimitRuleName,
  caller: { userId?: string | null; ip?: string | null }
): string {
  const subject = caller.userId || (caller.ip ? `ip:${caller.ip}` : "anonymous");
  return `${rule}:${subject}`;
}

/** The address the request appears to come from, honouring a trusted proxy. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? null;
}