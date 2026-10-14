"use client";

export default function SheetsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-base font-bold text-text-primary">Roadmap failed to load.</h2>
      <p className="text-xs text-text-secondary">Curated sheets are static and safe. Retry to continue practicing.</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold cursor-pointer">
        Retry roadmap
      </button>
    </div>
  );
}
