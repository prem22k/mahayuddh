"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Users, Copy, Check, ArrowRight } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { joinSquad } from "@/lib/data/squads";
import { track } from "@/lib/analytics";

interface Preview {
  squad: { id: string; name: string; description: string | null };
  member_count: number;
  sample_members: { profile: { username: string; avatar_url: string | null } }[];
}

export default function SquadJoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const code = (params.code || "").toUpperCase();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("invite_opened", { invite_code: code });
    fetch(`/api/squads/preview/${code}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || "No squad found for that code.");
          return;
        }
        setPreview(json as Preview);
      })
      .catch(() => setError("Couldn't load this invite. Check your connection."))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!user) {
      // Same-origin continuation: after signup the user returns to this invite.
      router.push(`/login?next=${encodeURIComponent(`/squad/join/${code}`)}`);
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await joinSquad(code);
      await refreshProfile();
      router.push("/squad");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <PageLoader label="Loading invite..." />;

  return (
    <div className="max-w-md mx-auto space-y-6 select-none pt-8">
      <div className="text-center">
        <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">Squad invite</div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">You&apos;re invited to battle together</h1>
      </div>

      {error && !preview ? (
        <div className="p-8 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
          <p className="text-xs text-[#ff453a]">{error}</p>
          <Link href="/" className="inline-block px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold">
            Start solo instead
          </Link>
        </div>
      ) : preview ? (
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#fa586a]/15 border border-[#fa586a]/30 flex items-center justify-center text-[#fa586a]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">{preview.squad.name}</h2>
              <p className="text-[11px] text-white/40 font-mono">{preview.member_count} member{preview.member_count === 1 ? "" : "s"}</p>
            </div>
          </div>
          {preview.squad.description && <p className="text-xs text-white/50">{preview.squad.description}</p>}
          <div className="flex items-center gap-2">
            {preview.sample_members.map((m, i) => (
              <div key={i} className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center font-bold text-[10px] text-white overflow-hidden" title={m.profile.username}>
                {m.profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.profile.avatar_url} alt={m.profile.username} className="w-full h-full object-cover" />
                ) : (
                  m.profile.username.charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-[#ff453a]">{error}</p>}
          <button onClick={handleJoin} disabled={joining}
            className="w-full py-3 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
            <span>{joining ? "Joining…" : user ? "Join squad" : "Log in to join"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={async () => {
              if (await copyText(code)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="w-full py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 text-xs font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : `Code: ${code}`}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
