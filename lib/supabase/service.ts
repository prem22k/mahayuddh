// Server-only helpers for API routes. The service key bypasses RLS, so this
// module must never be imported from client components.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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
 * Cron/seed guard: server-only secret via header only — never a ?key= query
 * param (URLs land in proxy/CDN logs, leaking the secret).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return extractBearerToken(request) === secret;
}
