"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-lg font-bold text-text-primary">Something broke on this page.</h2>
      <p className="text-xs text-text-secondary">
        Your battles, squads, and notes are safe. {error.digest ? `Ref ${error.digest}. ` : ""}Try again.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold transition-colors cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}
