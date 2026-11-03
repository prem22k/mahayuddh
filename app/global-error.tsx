"use client";

import { useEffect } from "react";
import "./globals.css";
import { ErrorScreen, type ErrorAction } from "@/components/errors/ErrorScreen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const backupUrl = process.env.NEXT_PUBLIC_BACKUP_URL;

  useEffect(() => {
    console.error(error);
  }, [error]);

  const actions: ErrorAction[] = [
    { label: "Reload Mahayuddh", onClick: reset, primary: true },
  ];

  if (backupUrl) {
    actions.push({ label: "Open backup server", href: backupUrl });
  }

  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-text-primary antialiased">
        <ErrorScreen
          variant="page"
          title="Mahayuddh hit a snag"
          body="Reload to get back to your battles. Nothing you solved was lost — progress lives in the database, not this tab."
          detail={error.digest ? `Ref ${error.digest}` : undefined}
          actions={actions}
        >
          {backupUrl && (
            <p className="mx-auto max-w-sm text-center text-xs text-text-tertiary">
              The backup needs about a minute to wake up, and you will need to sign in again.
            </p>
          )}
        </ErrorScreen>
      </body>
    </html>
  );
}
