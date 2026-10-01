"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center" role="alert">
          <h1 className="text-2xl font-black">Mahayuddh crashed.</h1>
          <p className="text-xs text-white/40 max-w-sm">
            Reload to get back to your battles. Nothing you solved was lost — progress lives in the database, not this tab.
            {error.digest ? ` Ref ${error.digest}.` : ""}
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-full bg-[#fa586a] text-white text-xs font-bold cursor-pointer"
          >
            Reload Mahayuddh
          </button>
        </div>
      </body>
    </html>
  );
}
