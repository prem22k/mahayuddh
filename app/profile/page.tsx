import Link from "next/link";

export const metadata = { title: "Profile | Mahayuddh" };

// Phase 0 skeleton: journey profiles (dimensions, no single score) land in Phase 4 Step 22.
// Today: dossier modal on Arena/Leaderboard + connect handle are the live surfaces.
export default function ProfilePage() {
  return (
    <div className="space-y-8 select-none">
      <div>
        <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
          What have I become good at?
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Profile</h1>
        <p className="text-xs text-white/40 mt-1">
          Your learning journey — battles, patterns, approaches, improvements — will live here. For now:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/" className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] transition-all">
          <div className="text-sm font-bold text-white">Open your Warrior Dossier →</div>
          <p className="text-[11px] text-white/40 mt-1">Arena → Your Progress → Warrior Dossier. Stats, radar, history.</p>
        </Link>
        <Link href="/notebook" className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] transition-all">
          <div className="text-sm font-bold text-white">What do I know? →</div>
          <p className="text-[11px] text-white/40 mt-1">Your shared templates and interview logs in the vault.</p>
        </Link>
      </div>
    </div>
  );
}
