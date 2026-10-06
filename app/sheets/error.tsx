"use client";

export default function SheetsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-base font-bold text-white">Roadmap failed to load.</h2>
      <p className="text-xs text-white/55">Curated sheets are static and safe. Retry to continue practicing.</p>
      <button onClick={reset} className="px-4 py-2 rounded-full btn-accent text-white text-xs font-bold cursor-pointer">
        Retry roadmap
      </button>
    </div>
  );
}
