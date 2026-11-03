/**
 * Server error tracking: Next.js calls onRequestError for errors thrown while
 * rendering pages and running route handlers and server actions. Reported to
 * PostHog (lib/posthog/server) only in the Node.js runtime and only when
 * NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN / _HOST are set.
 */
export function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("./lib/posthog/server");
  await reportServerError(error, {
    // The route pattern, not the URL: no ids or query strings.
    route: context.routePath,
    route_type: context.routeType,
    router: context.routerKind,
    method: request.method,
    digest: (error as { digest?: string })?.digest,
  });
}
