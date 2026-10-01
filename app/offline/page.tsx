import Link from "next/link";

export const metadata = {
  title: "Offline | Mahayuddh",
  description: "You are offline. Your progress is safe.",
};

export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-black text-white">You are offline.</h1>
      <p className="text-xs text-white/40 max-w-sm">
        Battles need a connection to record proof honestly. Reconnect, then start your battle — your scratchpad drafts in this tab are preserved.
      </p>
      <Link href="/" className="px-5 py-2.5 rounded-full bg-[#fa586a] text-white text-xs font-bold">
        Back to Arena
      </Link>
    </div>
  );
}
