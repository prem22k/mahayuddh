"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Report an error that an error.tsx boundary caught. Errors a boundary
 * renders never reach window.onerror, so PostHog's exception autocapture
 * can't see them on its own. No-op when PostHog isn't configured.
 */
export function useReportError(error: (Error & { digest?: string }) | undefined): void {
  useEffect(() => {
    if (!error || !posthog.__loaded) return;
    posthog.captureException(error, { digest: error.digest, boundary: true });
  }, [error]);
}
