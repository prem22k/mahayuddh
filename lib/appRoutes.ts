/**
 * Every page route in app/, one entry per page.tsx. `[param]` matches one
 * path segment.
 *
 * The session gate uses this to tell a protected page from a path that does
 * not exist: a signed-out visitor on a real page goes to /login, but a typo
 * gets the 404 page, not a login form for a page that isn't there.
 *
 * tests/routes/appRoutes.test.mjs compares this list with app/ and fails when
 * a page is added or removed without updating it.
 */
export const APP_PAGE_ROUTES = [
  "/",
  "/a/[id]",
  "/approach/[id]",
  "/auth/update-password",
  "/b/[id]",
  "/c/[id]",
  "/challenges",
  "/feed",
  "/home",
  "/leaderboard",
  "/login",
  "/notebook",
  "/notifications",
  "/offline",
  "/patterns",
  "/patterns/[topic]",
  "/practice",
  "/practice/[slug]",
  "/practice/[slug]/compare",
  "/primers",
  "/primers/[slug]",
  "/privacy",
  "/profile",
  "/sheets/[slug]",
  "/squad",
  "/squad/[id]/recaps",
  "/squad/[id]/recaps/[recapId]",
  "/squad/[id]/seasons/[seasonId]",
  "/squad/[id]/wall",
  "/squad/join/[code]",
  "/stuck",
  "/terms",
  "/u/[username]",
  "/validation",
  "/vault",
  "/welcome",
] as const;

const PATTERNS = APP_PAGE_ROUTES.map(
  (route) =>
    new RegExp(
      "^" +
        route
          .split("/")
          .map((seg) => (/^\[[^\]]+\]$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|\\]/g, "\\$&")))
          .join("/") +
        "$"
    )
);

/** True when `pathname` is served by a page in app/ (trailing slash ignored). */
export function isAppPage(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PATTERNS.some((re) => re.test(p));
}
