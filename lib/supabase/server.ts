import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CookieToSet {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
}

/**
 * Explicit cookie attributes for the Supabase session cookie.
 *
 * @supabase/ssr 0.5.2's built-in default is `{ path: "/", sameSite: "lax",
 * httpOnly: false, maxAge: 400d }` — no `secure` flag at all. Without it, a
 * session cookie is transmitted over plain HTTP, which makes every
 * cookie-authenticated state change replayable by anyone who can see the
 * request once (a captive portal, a hostile Wi-Fi, a misconfigured proxy).
 *
 * `SameSite=Lax` is kept as-is. It is the right value for this app because the
 * OAuth callback is a top-level GET navigation from an identity provider, which
 * Lax permits and `Strict` would break.
 *
 * `httpOnly` is deliberately NOT set. The browser Supabase client
 * (lib/supabase/client.ts) reads the same cookie to hold a session for RLS-scoped
 * client queries; flipping it to true logs every client-side query out. The
 * residual risk is that an XSS bug could read the session, and the mitigation is
 * the CSP plus the absence of any `dangerouslySetInnerHTML` call site — not a
 * flag that would break the architecture. Recorded as residual risk rather than
 * silently "fixed" in a way that stops the product working.
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false as const,
  // Only over HTTPS. Left off in development so `http://localhost:3000` keeps
  // working; a browser ignores Secure cookies sent over plain HTTP anyway, so
  // the flag is meaningless there.
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 400,
};

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return createServerClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Every cookie this module writes is a session cookie, so the flags
            // are enforced here rather than trusted from the library's defaults.
            cookieStore.set(name, value, {
              ...SESSION_COOKIE_OPTIONS,
              ...options,
              // Re-assert after the spread: the library's defaults include no
              // `secure`, and an `options` object from a caller must not be able
              // to drop it.
              secure: SESSION_COOKIE_OPTIONS.secure,
              httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
              sameSite: SESSION_COOKIE_OPTIONS.sameSite,
            });
          });
        } catch {
          // Handled in Server Component
        }
      },
    },
  });
}