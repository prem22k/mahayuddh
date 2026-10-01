"use client";

export default function SuggestionsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-base font-bold text-white">Challenges failed to load.</h2>
      <p className="text-xs text-white/40">Your pending challenges are safe. Retry to see who challenged you.</p>
      <button onClick={reset} className="px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold cursor-pointer">
        Retry challenges
      </button>
    </div>
  );
}
