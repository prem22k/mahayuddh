import type { NextConfig } from "next";
import path from "path";
import { securityHeaders, noStoreHeaders } from "./lib/security/headers";
import { AVATAR_HOSTS } from "./lib/security/urls";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // No framework fingerprint on responses (control 15 hygiene).
  poweredByHeader: false,
  images: {
    // Same hosts the avatar URL validator accepts (lib/security/urls.ts), so
    // the two can't disagree about which pictures render.
    remotePatterns: AVATAR_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  /**
   * Security response headers.
   *
   * They live here rather than in middleware on purpose: these must be on the
   * static asset responses and the error responses too, and middleware does not
   * run for `/_next/static`. The header set itself is `lib/security/headers.ts`
   * so it can be asserted in tests instead of trusted as a comment.
   */
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const toList = (map: Record<string, string>) =>
      Object.entries(map).map(([key, value]) => ({ key, value }));

    return [
      {
        source: "/:path*",
        headers: toList(securityHeaders({ isDev })),
      },
      {
        // Authenticated JSON must never sit in a shared cache or a service worker's
        // cache after logout.
        source: "/api/:path*",
        headers: toList(noStoreHeaders()),
      },
    ];
  },
};

export default nextConfig;