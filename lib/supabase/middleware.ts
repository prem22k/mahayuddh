import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

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
  const isPublicApi =
    request.nextUrl.pathname.startsWith("/api/sync") ||
    request.nextUrl.pathname.startsWith("/api/auth");

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
  // - Public/login/auth routes pass through immediately
  // - Protected routes redirect to /login
  if (!hasAuthCookie) {
    if (isLoginPage || isAuthCallback || isPublicApi) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return createRedirect(url, supabaseResponse);
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
    if (!user && !isLoginPage && !isAuthCallback && !isPublicApi) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return createRedirect(url, supabaseResponse);
    }

    // If user is already authenticated and visits /login, redirect to /
    if (user && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return createRedirect(url, supabaseResponse);
    }
  } catch (err) {
    console.warn("Supabase auth check in middleware encountered an error:", err);
    if (!isLoginPage && !isAuthCallback && !isPublicApi) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return createRedirect(url, supabaseResponse);
    }
  }

  return supabaseResponse;
}
