import type { MetadataRoute } from "next";
import { getServiceClient } from "@/lib/supabase/service";

// Only genuinely public, stable, indexable surfaces (Bible §14 + Principle 6).
// Deliberately absent: /challenge*, /approach*, /practice/[slug] histories,
// /leaderboard — all private or per-user. A sitemap that leaks them is a privacy
// bug, not an SEO win.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/home`, lastModified: now, priority: 1 },
    { url: `${base}/practice`, lastModified: now, priority: 0.9 },
    { url: `${base}/primers`, lastModified: now, priority: 0.9 },
    { url: `${base}/challenges`, lastModified: now, priority: 0.6 },
    { url: `${base}/leaderboard`, lastModified: now, priority: 0.5 },
    { url: `${base}/sheets/neetcode-150`, lastModified: now, priority: 0.7 },
    { url: `${base}/sheets/blind-75`, lastModified: now, priority: 0.7 },
    { url: `${base}/sheets/striver-sde`, lastModified: now, priority: 0.7 },
  ];

  // Public primers are the teaching surface. If the DB is unreachable we still
  // return the static routes rather than failing the whole sitemap.
  try {
    const supabase = getServiceClient();
    if (!supabase) return staticRoutes;

    const { data: primers, error } = await supabase
      .from("primers")
      .select("slug, updated_at")
      .eq("visibility", "public")
      .order("created_at", { ascending: true });
    if (error || !primers) return staticRoutes;

    const primerRoutes: MetadataRoute.Sitemap = primers.map((p) => ({
      url: `${base}/primers/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      priority: 0.8,
    }));

    return [...staticRoutes, ...primerRoutes];
  } catch {
    return staticRoutes;
  }
}