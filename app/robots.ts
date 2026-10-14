import type { MetadataRoute } from "next";

// Private-by-default is a product principle (Bible Principle 6), so the
// disallow list is the honest expression of it — not an afterthought.
const PRIVATE_PREFIXES = [
  "/api/",
  "/auth/",
  "/challenges",
  "/leaderboard",
  "/notebook",
  "/practice/",
  "/squad",
  "/feed",
  "/profile",
  "/b/",
  "/approach/",
  "/sheets/",
];

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/home", "/primers", "/primers/"],
        disallow: PRIVATE_PREFIXES,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}