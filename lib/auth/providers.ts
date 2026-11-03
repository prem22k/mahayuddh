/**
 * Social sign-in providers the login page can offer, in display order.
 *
 * Which of them are switched on lives in Supabase (Authentication > Sign In /
 * Providers), not here: enabledOAuthProviders() reads the project's public
 * auth settings, so a provider's button appears once it is enabled there and
 * never before. A button for a provider that is still off would fail with a
 * Supabase error page.
 *
 * `id` is the Supabase provider key. X uses the OAuth 2.0 provider ("x");
 * the OAuth 1.0a "twitter" provider is being retired by Supabase.
 */
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
  { id: "gitlab", label: "GitLab" },
  { id: "linkedin_oidc", label: "LinkedIn" },
  { id: "x", label: "X" },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]["id"];

const IDS = new Set<string>(OAUTH_PROVIDERS.map((p) => p.id));

export function isOAuthProviderId(value: unknown): value is OAuthProviderId {
  return typeof value === "string" && IDS.has(value);
}

/** Display order filter: keeps OAUTH_PROVIDERS' order, drops anything unknown. */
export function orderedProviders(enabled: Iterable<string>): OAuthProviderId[] {
  const on = new Set(enabled);
  return OAUTH_PROVIDERS.map((p) => p.id).filter((id) => on.has(id));
}

/**
 * The providers switched on for this project, read from Supabase's public
 * `/auth/v1/settings` (the same endpoint supabase-js uses; it needs only the
 * publishable key). Cached for five minutes so a busy login page costs one
 * request per five minutes, not one per visitor. Any failure returns [] and
 * the page falls back to email only.
 *
 * AUTH_PROVIDERS_PREVIEW=all (or a comma list) shows buttons regardless, for
 * designing the page locally; it is ignored in production builds.
 */
export async function enabledOAuthProviders(): Promise<OAuthProviderId[]> {
  const preview = process.env.AUTH_PROVIDERS_PREVIEW;
  if (preview && process.env.NODE_ENV !== "production") {
    return preview.trim() === "all"
      ? OAUTH_PROVIDERS.map((p) => p.id)
      : orderedProviders(preview.split(",").map((s) => s.trim()));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { external?: Record<string, unknown> };
    const external = body.external ?? {};
    return orderedProviders(Object.keys(external).filter((k) => external[k] === true));
  } catch {
    return [];
  }
}
