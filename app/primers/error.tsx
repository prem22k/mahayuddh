"use client";
import { useReportError } from "@/lib/posthog/useReportError";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function PrimersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorScreen
      variant="inline"
      title="Couldn't load primers"
      body="The pattern primers couldn't be loaded right now. Try again, or browse practice problems."
      detail={error.digest ? `Ref ${error.digest}` : undefined}
      actions={[
        { label: "Try again", onClick: reset, primary: true },
        { label: "Browse practice", href: "/practice" },
      ]}
    />
  );
}
