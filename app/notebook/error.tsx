"use client";

export default function VaultError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-12 text-center space-y-4" role="alert">
      <h2 className="text-base font-bold text-white">Vault failed to load.</h2>
      <p className="text-xs text-white/55">Shared templates are safe. Retry to browse them.</p>
      <button onClick={reset} className="px-4 py-2 rounded-full btn-accent text-white text-xs font-bold cursor-pointer">
        Retry vault
      </button>
    </div>
  );
}
