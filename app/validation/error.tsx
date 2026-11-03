"use client";
import { useReportError } from "@/lib/posthog/useReportError";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function ValidationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorScreen
      variant="inline"
      title="Couldn't load verification"
      body="Verification status and sync couldn't be loaded right now. Try again, or go to the arena."
      detail={error.digest ? `Ref ${error.digest}` : undefined}
      actions={[
        { label: "Try again", onClick: reset, primary: true },
        { label: "Go to Arena", href: "/home" },
      ]}
    />
  );
}
