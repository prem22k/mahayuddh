import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { safeNext } from "@/lib/safeNext";

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
// Invite + share deep links preview for logged-out users (Bible §42: preview
  // first, signup second). Join/accept/start actions still require auth inside
  // the pages. /b/* is the share surface (Step 16) — a share link that demands a
  // login before showing anything cannot drive Loop B growth.
  const isInvitePath =
    request.nextUrl.pathname.startsWith("/c/") ||
    request.nextUrl.pathname.startsWith("/b/") ||
    request.nextUrl.pathname.startsWith("/u/") ||
    request.nextUrl.pathname.startsWith("/squad/join/");

  // A single public primer is a share surface. The layout already generates
  // real per-primer metadata for public primers (Bible §14), so blocking the
  // route meant a share preview could never exist. RLS keeps squad primers out
  // of a logged-out request's reach: `getPrimer` returns null and the page says
  // not found, so this allowlist cannot leak a private primer. The list at
  // /primers stays authenticated.
  const isPublicPrimerPath = /^\/primers\/[^/]+$/.test(request.nextUrl.pathname);

  // One frozen recap is public (Step 20) so a shared week renders for a
  // logged-out visitor. Matched precisely: the *list* at /squad/[id]/recaps
  // still requires auth, because it offers the generate button.
  const isPublicRecapPath = /^\/squad\/[^/]+\/recaps\/[^/]+$/.test(
    request.nextUrl.pathname
  );

  // A finished season is a shareable result (§38), matched precisely. The
  // squad's season LIST stays authenticated.
  const isPublicSeasonPath = /^\/squad\/[^/]+\/seasons\/[^/]+$/.test(
    request.nextUrl.pathname
  );
  const isPublicSharePath =
    isInvitePath || isPublicRecapPath || isPublicPrimerPath || isPublicSeasonPath;

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
    return loginUrlFor(request, supabaseResponse);
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
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
      return loginUrlFor(request, supabaseResponse);
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
