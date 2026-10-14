import type { NextConfig } from "next";
import path from "path";
import { securityHeaders, noStoreHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // No framework fingerprint on responses (control 15 hygiene).
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.leetcode.com",
      },
      {
        protocol: "https",
        hostname: "leetcode.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
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