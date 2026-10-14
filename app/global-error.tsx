"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const backupUrl = process.env.NEXT_PUBLIC_BACKUP_URL;
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-text-primary antialiased">
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center" role="alert">
          <h1 className="text-2xl font-semibold">Mahayuddh crashed.</h1>
          <p className="text-xs text-text-secondary max-w-sm">
            Reload to get back to your battles. Nothing you solved was lost — progress lives in the database, not this tab.
            {error.digest ? ` Ref ${error.digest}.` : ""}
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold cursor-pointer"
          >
            Reload Mahayuddh
          </button>
          {backupUrl && (
            <div className="flex flex-col items-center gap-1">
              <a
                href={backupUrl}
                className="px-5 py-2.5 rounded-full bg-surface-overlay text-text-primary hover:brightness-110 text-xs font-bold"
              >
                Open backup server
              </a>
              <p className="text-xs text-text-tertiary max-w-sm">
                The backup needs about a minute to wake up, and you will need to sign in again.
              </p>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
