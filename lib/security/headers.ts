/**
 * Security response headers, as data.
 *
 * Kept alias-free and environment-agnostic so `next.config.ts` can import it
 * (next.config is transpiled on its own and cannot resolve the `@/` alias) and
 * so `tests/security/` can assert the actual header set rather than a comment
 * claiming it exists.
 *
 * What is deliberately NOT here:
 *
 *   - `preload` on HSTS. Preload is an operational commitment for the whole
 *     domain tree and it is very hard to undo. Not ours to make unilaterally.
 *   - `includeSubDomains`. The whole tree being HTTPS-safe is a fact about the
 *     deployment, not about this repository, so asserting it here would be a
 *     guess dressed as a control.
 *   - A strict CSP. This app has ~115 inline `style={{...}}` bindings and Next
 *     App Router injects inline bootstrap scripts, so `style-src 'unsafe-inline'`
 *     and a script nonce-free `script-src 'unsafe-inline'` are the honest
 *     values today. A nonce needs the request path made dynamic everywhere,
 *     which costs more than the control is worth on a server-rendered app with
 *     zero `dangerouslySetInnerHTML` call sites. The residual risk is stated in
 *     the report rather than papered over with a policy the app cannot hold.
 */

/** Same-origin static/SSR assets plus what the browser genuinely talks to. */
const CONNECT_SRC = [
  "'self'",
  // Supabase over HTTPS and its websocket endpoint. The deployment's own host is
  // added from the environment when it is not the default `*.supabase.co`.
  "https://*.supabase.co",
  "wss://*.supabase.co",
];

function supabaseConnectOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "wss:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/** The development server needs eval (source maps) and a websocket to itself. */
function devOnlyConnectSources(): string[] {
  return ["ws://localhost:*", "http://localhost:*", "https://localhost:*"];
}

function devOnlyScriptSources(): string[] {
  return ["'unsafe-eval'"];
}

export function contentSecurityPolicy(isDev: boolean): string {
  const connect = [...CONNECT_SRC];
  if (isDev) connect.push(...devOnlyConnectSources());

  // The project host when Supabase is served from a custom domain, which the
  // `*.supabase.co` wildcard would miss.
  const customSupabase = supabaseConnectOrigin();
  if (customSupabase && !connect.includes(customSupabase)) connect.push(customSupabase);

  const script = ["'self'", "'unsafe-inline'"];
  if (isDev) script.push(...devOnlyScriptSources());

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    // Next's bundler emits inline scripts for the RSC payload and hydration.
    ["script-src", script],
    // Unavoidable while `style={{...}}` is used across the component tree.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // `https:` because avatar_url is user-supplied and rendered directly.
    // An <img> cannot execute script, so this is tracking-pixel risk, not XSS.
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connect],
    ["manifest-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["media-src", ["'self'"]],
    // Nothing here embeds a third party, and nothing should ever.
    ["frame-src", ["'none'"]],
    ["child-src", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    // Clickjacking. The legacy X-Frame-Options below is the belt.
    ["frame-ancestors", ["'none'"]],
  ];

  // Only meaningful over HTTPS; harmless (and ignored) on plain http://localhost.
  directives.push(["upgrade-insecure-requests", []]);

  return directives
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

/**
 * Header map applied to every response.
 *
 * `isDev` only relaxes the two directives that make the dev overlay work, so a
 * production build ships the strict set whether it was built by CI or by hand.
 */
export function securityHeaders(options: { isDev: boolean }): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(options.isDev),
    // One year. Long enough to matter against a downgrade, short enough that a
    // misconfiguration is not a year-long commitment. No preload.
    "Strict-Transport-Security": "max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    // Superseded by CSP frame-ancestors, still honoured by older browsers.
    "X-Frame-Options": "DENY",
    // Cross-origin requests get the origin only, so an invite token in `?ref=`
    // is never handed to leetcode.com or any other third party.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()",
    // The legacy auditor has caused more XSS holes than it closed.
    "X-XSS-Protection": "0",
    "X-DNS-Prefetch-Control": "off",
    // A service worker that caches first-party HTML must not be readable by a
    // different origin through an opaque response.
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/**
 * API responses must never be cached by a shared cache or a service worker.
 *
 * Separate from `securityHeaders` because `next.config.ts` needs to scope this
 * to `/api/:path*` while the rest applies everywhere.
 */
export function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  };
}