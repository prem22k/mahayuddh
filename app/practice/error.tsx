"use client";

export default function PracticeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-base font-bold text-text-primary">Practice failed to load.</h2>
      <p className="text-xs text-text-secondary">Your solves, battles, and notes are safe. Retry to keep practicing.</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold cursor-pointer">
        Retry practice
      </button>
    </div>
  );
}
