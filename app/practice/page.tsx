import Link from "next/link";

export const metadata = { title: "Practice | Mahayuddh" };

import { PracticeHub } from "@/components/practice/PracticeHub";

// Practice hub (Bible §52, §23, §25): Review due / Weak patterns / Continue / New.
export default function PracticePage() {
  return (
    <div className="space-y-8 select-none">
      <div>
        <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
          What should I solve?
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Practice</h1>
        <p className="text-xs text-white/40 mt-1">Revisit what&apos;s fading. Attack weak patterns. Then go new.</p>
      </div>
      <PracticeHub />
      <Link href="/" className="inline-block text-xs text-[#fa586a] font-semibold hover:underline">
        ← Today&apos;s battle on the Arena
      </Link>
    </div>
  );
}
