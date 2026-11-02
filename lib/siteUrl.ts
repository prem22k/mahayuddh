// NEXT_PUBLIC_SITE_URL has been set with a trailing slash in production, which
// produced `//` in generated URLs and broke Origin comparisons. Normalize once.
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return raw || "http://localhost:3000";
}

export function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, "");
}
