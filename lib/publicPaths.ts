/**
 * Pages a signed-out visitor may open (share and resilience surfaces).
 *
 * One list for two readers: the middleware lets these through without a
 * session, and the app shell uses it while auth is still resolving to decide
 * whether to draw the signed-in chrome (every other page requires a session,
 * so its visitor is signed in). Keeping it in one place means the two can never
 * disagree about which pages are public.
 *
 * /login, /auth/* and /api/* are handled separately by the middleware.
 */
export function isPublicSharePath(pathname: string): boolean {
  const p = pathname;

  // Invite + share deep links preview for logged-out users (Bible §42: preview
  // first, signup second). Join/accept/start actions still require auth inside
  // the pages. /b/* is the share surface (Step 16) — a share link that demands a
  // login before showing anything cannot drive Loop B growth.
  // /a/* is the public approach projection (Wave D): visibility=public rows
  // only, served by the service client. Private rows redirect to login inside
  // the page, so the allowlist cannot leak them.
  const isInvitePath =
    p.startsWith("/c/") ||
    p.startsWith("/b/") ||
    p.startsWith("/a/") ||
    p.startsWith("/u/") ||
    p.startsWith("/squad/join/");

  // Social-card renders must be fetchable by scrapers, which never carry a
  // session. Every /opengraph-image (welcome, invites, recaps, primers) renders
  // public-safe content by construction — the invite card deliberately omits
  // anything the preview API wouldn't show a stranger — so the whole family is
  // exempt rather than allowlisted one route at a time.
  const isSocialCard = p.endsWith("/opengraph-image") || p.endsWith("/twitter-image");

  // A single public primer is a share surface. The layout already generates
  // real per-primer metadata for public primers (Bible §14), so blocking the
  // route meant a share preview could never exist. RLS keeps squad primers out
  // of a logged-out request's reach: `getPrimer` returns null and the page says
  // not found, so this allowlist cannot leak a private primer. The list at
  // /primers stays authenticated.
  const isPublicPrimerPath = /^\/primers\/[^/]+$/.test(p);

  // Step 3's public landing. Every share surface in the product sends somebody
  // here, and §42 says a share link has to show context before it asks for an
  // account — "here is a login form" is not context.
  const isWelcomePath = p === "/welcome";

  // One frozen recap is public (Step 20) so a shared week renders for a
  // logged-out visitor. Matched precisely: the *list* at /squad/[id]/recaps
  // still requires auth, because it offers the generate button.
  const isPublicRecapPath = /^\/squad\/[^/]+\/recaps\/[^/]+$/.test(p);

  // A finished season is a shareable result (§38), matched precisely. The
  // squad's season LIST stays authenticated.
  const isPublicSeasonPath = /^\/squad\/[^/]+\/seasons\/[^/]+$/.test(p);

  // Crawler + resilience surfaces. /sitemap.xml and /robots.txt must answer
  // for search engines (bouncing them to /login silently de-indexes the
  // public pages). /offline is the PWA + failover hub: the service worker
  // falls back to it with no network, and logged-out visitors must reach it
  // for the backup-server path to exist at all.
  const isCrawlerOrResiliencePath = p === "/offline" || p === "/sitemap.xml" || p === "/robots.txt";

  return (
    isInvitePath ||
    isPublicRecapPath ||
    isPublicPrimerPath ||
    isPublicSeasonPath ||
    isWelcomePath ||
    isSocialCard ||
    isCrawlerOrResiliencePath
  );
}
