import Link from "next/link";

export const metadata = { title: "Primers | Mahayuddh" };

import { PrimerList } from "@/components/primers/PrimerList";

export default function PrimersPage() {
  return (
    <div className="space-y-6 select-none max-w-3xl">
      <div>
        <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
          Learn before battle
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Pattern Primers</h1>
        <p className="text-xs text-white/40 mt-1">
          5–10 minute reads. One concept, immediately usable. Skim one, then start battling.
        </p>
      </div>
      <PrimerList />
      <Link href="/practice" className="inline-block text-xs text-[#fa586a] font-semibold hover:underline">
        ← Back to practice
      </Link>
    </div>
  );
}
