"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Play, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { getSuggestionById, getChallengeChain } from "@/lib/data/suggestions";
import { track } from "@/lib/analytics";
import { Suggestion } from "@/types/database";

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// /c/[id] — challenge deep link (Bible §42): problem + target + message, no
// spoiler by default. Minimal friction: preview first, signup second, battle third.
export default function ChallengeDeepLinkPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [item, setItem] = useState<Suggestion | null>(null);
  const [chain, setChain] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    track("invite_opened", { challenge_id: params.id });
    Promise.all([getSuggestionById(params.id), getChallengeChain(params.id)])
      .then(([row, ch]) => {
        if (!row) setNotFound(true);
        else {
          setItem(row);
          setChain(ch);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <PageLoader label="Loading challenge..." />;
  if (notFound || !item) {
    return (
      <div className="max-w-md mx-auto p-12 text-center space-y-3">
        <p className="text-sm font-bold text-white">Challenge not found.</p>
        <p className="text-xs text-white/40">It may have been deleted. Start your own battle instead.</p>
        <Link href="/" className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold">
          Start a battle
        </Link>
      </div>
    );
  }

  const isRecipient = user?.id === item.to_user;
  const showNote = !item.spoiler || isRecipient || item.status === "completed";

  const handleAccept = () => {
    if (!user) {
      // Preserve the destination so signup resumes on THIS challenge, not the
      // Arena (Bible §42: preview -> 1-click signup -> straight into the battle).
      router.push(`/login?next=${encodeURIComponent(`/c/${item.id}`)}`);
      return;
    }
    track("challenge_accepted", { suggestion_id: item.id });
    startSolving({
      id: 1,
      title: item.problem_title,
      slug: item.problem_slug,
      difficulty: item.difficulty,
      category: "Squad Challenge",
    });
    router.push("/");
  };

  return (
    <div className="max-w-md mx-auto space-y-6 select-none pt-8">
      <div className="text-center">
        <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
          @{item.from_profile?.username || "A squad mate"} challenged {isRecipient ? "you" : `@${item.to_profile?.username || "someone"}`}
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{item.problem_title}</h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <DifficultyBadge difficulty={item.difficulty} />
          {item.sender_time_sec != null && (
            <span className="text-xs text-[#0a84ff] font-mono font-bold">
              {item.beat_time ? `Can you beat ${fmtTime(item.sender_time_sec)}?` : `Solved in ${fmtTime(item.sender_time_sec)}`}
            </span>
          )}
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4">
        {showNote && item.note ? (
          <p className="text-xs text-white/70 italic">&ldquo;{item.note}&rdquo;</p>
        ) : item.spoiler ? (
          <p className="text-xs text-white/30 italic">Hidden hint — reveals when you accept.</p>
        ) : null}
        {item.deadline_at && (
          <p className="text-[11px] text-white/40 font-mono">Due {new Date(item.deadline_at).toLocaleDateString()}</p>
        )}
        <button onClick={handleAccept}
          className="w-full py-3 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5">
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{user ? (isRecipient ? "Accept challenge" : "Solve it too") : "Log in to accept"}</span>
        </button>
        {!user && (
          <p className="text-[11px] text-white/30 text-center">No long onboarding — log in and you land straight in the battle.</p>
        )}
      </div>

      {chain.length > 1 && (
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="text-[11px] font-bold text-[#bf5af2] uppercase tracking-wider">
            Challenge chain — {item.problem_title}
          </div>
          {chain.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 text-xs text-white/60">
              <span className="font-mono text-white/30">{i + 1}.</span>
              <span className="font-semibold text-white/80">@{c.from_profile?.username}</span>
              <ArrowRight className="w-3 h-3 text-white/20" />
              <span className="font-semibold text-white/80">@{c.to_profile?.username}</span>
              {c.status === "completed" && <span className="text-[#30d158] text-[10px] font-bold">done</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
