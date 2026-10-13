import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  checkCrossOriginRequest,
  isDeclaredCrossSite,
  parseAllowedOrigins,
} from "@/lib/security/crossOrigin";
import { declaredBodyTooLarge, maxBodyBytesFor } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";

/**
 * Per-path body ceiling, applied in middleware so an oversized request dies
 * before it reaches a route handler, a model call, or a database write.
 *
 * 64KB is the default: far above any interactive payload in this app and far
 * below what it takes to exhaust memory or a provider's token budget. The
 * one-click LeetCode import legitimately needs more, which is why the map lives
 * in lib/security/body.ts rather than as a single constant here.
 */

/**
 * Origins allowed to make cookie-authenticated state changes, besides our own.
 *
 * `https://leetcode.com` is here because /api/sync/solved-slugs is a bookmarklet
 * target and the app is the origin it writes into. It is an explicit, narrow
 * exception rather than a wildcard, and it still has to present a bearer token.
 */
const EXTRA_ALLOWED_ORIGINS = ["https://leetcode.com"];

function allowedOrigins(): string[] {
  return [
    ...EXTRA_ALLOWED_ORIGINS,
    ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
    ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  ];
}

export async function middleware(request: NextRequest) {
  // ── Body size ─────────────────────────────────────────────────────────────
  // Cheapest possible rejection: header comparison, no allocation, no read.
  const maxBodyBytes = maxBodyBytesFor(request.nextUrl.pathname);
  if (declaredBodyTooLarge(request, maxBodyBytes)) {
    logSecurityEvent("oversize_request", {
      method: request.method,
      path: request.nextUrl.pathname,
      limit_bytes: maxBodyBytes,
      declared_bytes: request.headers.get("content-length"),
    });
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── Cross-site request forgery ────────────────────────────────────────────
  // Fails closed. `checkCrossOriginRequest` resolves the Origin header against
  // the allowlist; `isDeclaredCrossSite` is the backstop for a browser that
  // sent Sec-Fetch-Site but no usable Origin, which is the shape of an actual
  // CSRF attempt and never the shape of the one configured cross-origin caller.
  const secFetchSite = request.headers.get("sec-fetch-site");
  const originVerdict = checkCrossOriginRequest({
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get("origin"),
    secFetchSite,
    requestOrigin: request.nextUrl.origin,
    allowedOrigins: allowedOrigins(),
  });
  const crossSiteDeclared =
    originVerdict.ok && isDeclaredCrossSite(secFetchSite)
      ? { ok: false, reason: "sec-fetch-site: cross-site with no allowlisted origin" }
      : originVerdict;

  if (!crossSiteDeclared.ok) {
    logSecurityEvent("csrf.rejected", {
      method: request.method,
      path: request.nextUrl.pathname,
      reason: crossSiteDeclared.reason,
      origin: request.headers.get("origin"),
      sec_fetch_site: secFetchSite,
    });
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg, sw.js, manifest.webmanifest
     * - static files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};