// Server-only helpers for API routes. The service key bypasses RLS, so this
// module must never be imported from client components.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/log";

export type ServiceClient = SupabaseClient;

/** Service-role client for server-side persistence (bypasses RLS). */
export function getServiceClient(): ServiceClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** `Authorization: Bearer <token>` -> token, or null when absent. */
export function extractBearerToken(request: Request): string | null {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return token || null;
}

/**
 * Constant-time string comparison for secrets.
 *
 * `===` short-circuits on the first differing byte, so the time it takes to
 * reject a guess leaks how much of the secret was right. That is a real
 * primitive against a high-entropy secret and it costs three lines to remove.
 * `timingSafeEqual` requires equal lengths, so the length check runs first —
 * length is not the secret.
 */
export function secretsMatch(candidate: string | null, expected: string | null): boolean {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Cron/seed guard: server-only secret via header only — never a ?key= query
 * param (URLs land in proxy/CDN logs, leaking the secret).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const presented = extractBearerToken(request);
  if (secretsMatch(presented, secret)) return true;
  logSecurityEvent("cron.denied", {
    path: new URL(request.url).pathname,
    // Never the value itself, and never its length.
    reason: "presented credential did not match",
  });
  return false;
}

/**
 * Resolve the caller from a Bearer JWT, falling back to server session
 * cookies. Null when neither proves a session.
 */
export async function resolveUser(bearerToken: string | null): Promise<User | null> {
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (bearerToken && anonUrl && anonKey) {
    try {
      const userClient = createClient(anonUrl, anonKey, { auth: { persistSession: false } });
      const { data } = await userClient.auth.getUser(bearerToken);
      if (data?.user) return data.user;
    } catch {
      // fall through to cookies
    }
  }
  try {
    const serverSupabase = await createServerClient();
    const { data } = await serverSupabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * `resolveUser` + an audit line when there is nobody.
 *
 * Every state-changing route needs the same two things — prove a caller, and
 * leave evidence when there is none — so they are one call. `context` is a short
 * route name (`/api/notify`), never a payload.
 */
export async function requireUser(
  request: Request,
  context: string
): Promise<{ user: User; response?: undefined } | { user?: undefined; response: NextResponse }> {
  const user = await resolveUser(extractBearerToken(request));
  if (!user) {
    logSecurityEvent("auth.denied", {
      route: context,
      method: request.method,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}