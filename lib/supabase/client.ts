import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

/**
 * Cookie attributes for the browser half of the session.
 *
 * Same values as SESSION_COOKIE_OPTIONS in lib/supabase/server.ts, repeated
 * because the two are separate clients with separate option bags and a mismatch
 * means the server and browser disagree about whether a cookie is usable.
 * `tests/security/securityBaseline.test.mjs` asserts the two stay equal.
 */
export const BROWSER_COOKIE_OPTIONS: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 400,
};

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // In local dev without env, return a safe dummy client that won't crash initial render
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key",
      { cookieOptions: BROWSER_COOKIE_OPTIONS }
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey, {
    cookieOptions: BROWSER_COOKIE_OPTIONS,
  });
}