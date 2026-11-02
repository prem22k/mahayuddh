import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { safeNext } from "@/lib/safeNext";
import { isPublicSharePath as isPublicPath } from "@/lib/publicPaths";

interface CookieToSet {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
}

function createRedirect(url: URL, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}

/** Login URL that remembers where the visitor was heading (Bible §42). */
/**
 * Where a signed-out visitor goes instead of a protected page. The bare root is
 * the front door: someone typing the address should meet the landing page, not
 * a login form. Its query string (?from=, campaign tags) rides along for
 * attribution. Every other path goes to /login with ?next= so the visitor comes
 * back to what they asked for.
 */
function signedOutRedirect(request: NextRequest, sourceResponse: NextResponse) {
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return createRedirect(url, sourceResponse);
  }
  return loginUrlFor(request, sourceResponse);
}

function loginUrlFor(request: NextRequest, sourceResponse: NextResponse) {
  const url = request.nextUrl.clone();
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", safeNext(target) ?? "/home");
  return createRedirect(url, sourceResponse);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  // API routes are NEVER middleware-redirected to /login.
  //
  // Every route under /api authenticates itself with resolveUser() or
  // isAuthorizedCron() and returns an honest JSON 401. Letting the middleware
  // 307 them turns an API call into an HTML redirect, so a logged-out caller
  // gets a login page instead of a status code — and a client following the
  // redirect POSTs to /login and gets a confusing 405.
  //
  // This was previously an allowlist of five prefixes, and every route added
  // after it silently inherited the bug. /api/push/deliver and
  // /api/squads/referral both did. An allowlist here can only ever be wrong in
  // one direction, so it is gone.
  const isApiRequest = request.nextUrl.pathname.startsWith("/api");

  // Share and resilience pages a signed-out visitor may open. The list lives
  // in lib/publicPaths so the app shell reads the same one.
  const isPublicSharePath = isPublicPath(request.nextUrl.pathname);

  // Fast-path: Check if any Supabase auth cookies exist in request
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) =>
      c.name.startsWith("sb-") ||
      c.name.includes("auth-token") ||
      c.name.includes("access_token") ||
      c.name.includes("supabase")
  );

  // If no auth cookie is present:
  // - Public/login/auth/invite routes pass through immediately
  // - Protected routes redirect to /login
  if (!hasAuthCookie) {
    if (isLoginPage || isAuthCallback || isApiRequest || isPublicSharePath) {
      return supabaseResponse;
    }
    return signedOutRedirect(request, supabaseResponse);
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[], headers?: Record<string, string>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          // @supabase/ssr >= 0.10 passes no-store cache headers alongside a
          // refreshed session so no CDN caches a response carrying it.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            // Flags enforced here, not taken from the library's defaults
            // (the library sets no `secure`). See SESSION_COOKIE_OPTIONS in
            // lib/supabase/server.ts for the full reasoning, including why
            // httpOnly stays false.
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            })
          );
        },
      },
    });

    const userPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null }, error: new Error("Auth request timed out") }), 2500)
    );

    const { data } = await Promise.race([userPromise, timeoutPromise]);
    const user = data?.user ?? null;

    // If user is not authenticated and trying to access protected route
    if (!user && !isLoginPage && !isAuthCallback && !isApiRequest && !isPublicSharePath) {
      return signedOutRedirect(request, supabaseResponse);
    }

    // Authenticated visitor on /login: honour ?next= so a challenge deep link
    // resumes at the battle instead of the Arena (Bible §42).
    if (user && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = safeNext(request.nextUrl.searchParams.get("next")) ?? "/home";
      url.search = "";
      return createRedirect(url, supabaseResponse);
    }
  } catch (err) {
    console.warn("Supabase auth check in middleware encountered an error:", err);
    if (!isLoginPage && !isAuthCallback && !isApiRequest && !isPublicSharePath) {
      return loginUrlFor(request, supabaseResponse);
    }
  }

  return supabaseResponse;
}
