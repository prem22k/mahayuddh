/**
 * PostHog error tracking, configured only from the environment:
 *   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN   the project's public token (phc_...)
 *   NEXT_PUBLIC_POSTHOG_HOST            the ingestion host, e.g. the EU or US cloud
 * Both missing or either missing: error tracking is off and nothing else
 * changes. In development that is said out loud, so a missing variable isn't
 * mistaken for "no errors".
 */
export interface PostHogConfig {
  token: string;
  host: string;
}

let warned = false;

export function posthogConfig(): PostHogConfig | null {
  // Referenced literally so Next inlines them in the browser bundle.
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim().replace(/\/+$/, "");
  if (token && host) return { token, host };
  if (process.env.NODE_ENV === "development" && !warned) {
    warned = true;
    const missing = !token ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN" : "NEXT_PUBLIC_POSTHOG_HOST";
    console.error(
      `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`
    );
  }
  return null;
}

/**
 * The host PostHog's browser SDK loads its lazy scripts from: the ingestion
 * host with "-assets" after the region (eu.i.posthog.com → eu-assets.i.posthog.com).
 * Used only to allow it in the Content-Security-Policy.
 */
export function posthogAssetsHost(host: string): string {
  return host.replace(/^(https?:\/\/)([a-z]+)\.i\.posthog\.com$/i, "$1$2-assets.i.posthog.com");
}
