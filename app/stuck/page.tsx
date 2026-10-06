import Link from "next/link";
import { StuckBoard } from "@/components/battle/StuckBoard";

export const metadata = {
  title: "Stuck | Mahayuddh",
  description: "Ask for the smallest amount of help that unsticks you, and help your squad do the same.",
};

/**
 * The Stuck ladder surface (Step 18, Bible §12).
 *
 * Reachable from the dock's "Stuck?" button and the feed. Not in the primary
 * nav: asking for help is a thing you do while solving, not a destination you
 * browse to. It gets a link from Home and the feed instead.
 */
export default function StuckPage() {
  return (
    <div className="space-y-6 select-none max-w-3xl">
      <Link href="/practice" className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors">
        ← Practice
      </Link>

      <header>
        <div className="text-[11px] font-bold text-[#ff9f0a] tracking-[0.2em] uppercase mb-1">
          Least help first
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Stuck
        </h1>
        <p className="text-xs text-white/55 mt-2 max-w-xl leading-relaxed">
          Ask for a nudge, a pattern hint, a direction, or the whole thing — and get exactly
          that. Helpers cannot give you more than you asked for. A hint you can act on teaches
          more than an answer that teaches nothing.
        </p>
      </header>

      <StuckBoard />
    </div>
  );
}
