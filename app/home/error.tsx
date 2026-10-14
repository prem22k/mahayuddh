"use client";

export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-base font-bold text-text-primary">Today&apos;s battle failed to load.</h2>
      <p className="text-xs text-text-secondary">Your squad&apos;s progress and streak are safe. Retry to see today&apos;s pick.</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold cursor-pointer">
        Retry battle
      </button>
    </div>
  );
}
