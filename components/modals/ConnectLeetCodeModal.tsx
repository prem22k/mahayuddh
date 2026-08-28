"use client";

import React, { useState } from "react";
import {
  X,
  Link2,
  Sparkles,
  Zap,
  Key,
  HelpCircle,
  Check,
  Copy,
  ArrowRight,
  ExternalLink,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ConnectLeetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export function ConnectLeetCodeModal({ isOpen, onClose, onConnected }: ConnectLeetCodeModalProps) {
  const { user, profile, session, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"handle" | "bookmarklet" | "session">("handle");
  const [username, setUsername] = useState(profile?.leetcode_username || "");
  const [password, setPassword] = useState("");
  const [sessionCookie, setSessionCookie] = useState("");
  const [showCookieGuide, setShowCookieGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const userToken = session?.access_token || "";

  // The 1-click browser snippet / bookmarklet script
  const bookmarkletCode = `javascript:(async()=>{try{const r=await fetch('https://leetcode.com/api/problems/algorithms/');if(!r.ok)throw new Error('Please login to leetcode.com first');const d=await r.json();const slugs=(d.stat_status_pairs||[]).filter(p=>p.status==='ac').map(p=>p.stat.question__title_slug);const s=await fetch('${currentOrigin}/api/sync/solved-slugs',{method:'POST',headers:{'Content-Type':'application/json','x-mahayuddh-token':'${userToken}'},body:JSON.stringify({slugs})});const res=await s.json();if(res.success){alert('🔥 Mahayuddh: Successfully synced '+res.imported+' solved problems to your roadmaps!');}else{alert('Error: '+(res.error||'Failed to sync'));}}catch(e){alert('Sync error: '+e.message);}})();`;

  const consoleSnippet = `(async () => {
  try {
    const res = await fetch('https://leetcode.com/api/problems/algorithms/');
    const data = await res.json();
    const slugs = (data.stat_status_pairs || [])
      .filter(p => p.status === 'ac')
      .map(p => p.stat.question__title_slug);
    
    console.log('Found ' + slugs.length + ' solved problems. Sending to Mahayuddh...');
    const syncRes = await fetch('${currentOrigin}/api/sync/solved-slugs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mahayuddh-token': '${userToken}'
      },
      body: JSON.stringify({ slugs })
    });
    const result = await syncRes.json();
    if (result.success) {
      alert('🎉 Mahayuddh: ' + result.imported + ' solved problems synced!');
    } else {
      console.error(result);
    }
  } catch (err) {
    console.error(err);
  }
})();`;

  // 1. Instant Handle Sync
  const handleInstantSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !username.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await syncUserProfileStats(user.id, username.trim());
      if (!updated) {
        setError("Could not find LeetCode account. Please check your username.");
        return;
      }

      await refreshProfile();
      setSuccess(`Connected @${username.trim()}! Solved stats, rating, and last 100 ACs synced.`);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.8 },
        colors: ["#fa586a", "#ffffff", "#ffd60a", "#30d158"],
      });
      setTimeout(() => {
        onConnected?.();
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Connect handle error:", err);
      setError("Failed to sync LeetCode stats. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Full History Session Sync (Cookie or password)
  const handleSessionSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/sync/leetcode-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
        },
        body: JSON.stringify({
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          sessionCookie: sessionCookie.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to import LeetCode history.");
        return;
      }

      setSuccess(`Imported ${json.imported ?? 0} solved problems. Your full history is now synced!`);
      setPassword("");
      setSessionCookie("");
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.8 },
        colors: ["#30d158", "#fa586a", "#ffffff"],
      });
      await refreshProfile();
      setTimeout(() => {
        onConnected?.();
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Connect history error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(consoleSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 select-none">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#fa586a]/15 border border-[#fa586a]/30 flex items-center justify-center text-[#fa586a]">
              <Link2 className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-white">Sync LeetCode Status</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] rounded-2xl border border-white/[0.06] my-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("handle");
              setError(null);
            }}
            className={cn(
              "py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1",
              activeTab === "handle"
                ? "bg-[#fa586a] text-white shadow-sm"
                : "text-white/50 hover:text-white"
            )}
          >
            <Sparkles className="w-3 h-3" />
            <span>Handle (Fast)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("bookmarklet");
              setError(null);
            }}
            className={cn(
              "py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1",
              activeTab === "bookmarklet"
                ? "bg-[#30d158] text-black shadow-sm font-black"
                : "text-white/50 hover:text-white"
            )}
          >
            <Zap className="w-3 h-3" />
            <span>1-Click Sync</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("session");
              setError(null);
            }}
            className={cn(
              "py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1",
              activeTab === "session"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/50 hover:text-white"
            )}
          >
            <Key className="w-3 h-3" />
            <span>Session</span>
          </button>
        </div>

        {/* ── Tab 1: Instant Handle Connect ── */}
        {activeTab === "handle" && (
          <form onSubmit={handleInstantSync} className="space-y-4">
            <p className="text-xs text-white/50 leading-relaxed">
              Sync your <strong className="text-white">contest rating, global rank, daily streak, and last 100 accepted problems</strong> automatically.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                LeetCode Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. your_handle"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono"
                required
                autoFocus
              />
            </div>

            {error && <div className="text-xs text-[#ff453a] font-medium bg-[#ff453a]/10 p-3 rounded-xl border border-[#ff453a]/20">{error}</div>}
            {success && <div className="text-xs text-[#30d158] font-medium bg-[#30d158]/10 p-3 rounded-xl border border-[#30d158]/20 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /><span>{success}</span></div>}

            <button
              type="submit"
              disabled={submitting || !username.trim()}
              className="w-full py-2.5 rounded-xl bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-bold text-xs shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Syncing LeetCode Stats...</span>
                </>
              ) : (
                <>
                  <span>Connect & Sync Stats</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── Tab 2: 1-Click Browser Sync (Zero-Friction) ── */}
        {activeTab === "bookmarklet" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#30d158]/10 border border-[#30d158]/20 text-xs text-[#30d158] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                <span>Zero Passwords • 1-Click Full History Sync</span>
              </div>
              <p className="text-[11px] text-white/70">
                Syncs all 500+ of your past solved questions into your roadmaps directly from your logged-in browser tab.
              </p>
            </div>

            {/* Method A: Drag Bookmarklet */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#fa586a]" />
                <span>Option 1: Drag to Bookmarks Bar</span>
              </div>
              <p className="text-[11px] text-white/40">
                Drag this button to your browser bookmarks bar once. Then click it while viewing LeetCode!
              </p>
              <div className="pt-1">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a
                  href={bookmarkletCode}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Drag this button to your browser bookmarks bar (Ctrl+Shift+B)!");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#fa586a] to-[#ff8a9c] text-white text-xs font-black shadow-glow cursor-grab active:cursor-grabbing"
                  title="Drag me to your bookmarks toolbar!"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>⚡ Sync to Mahayuddh</span>
                </a>
              </div>
            </div>

            {/* Method B: Console Snippet */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                  <span>Option 2: 1-Click Console Snippet</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-bold text-white flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3 h-3 text-[#30d158]" />
                      <span className="text-[#30d158]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              </div>

              <ol className="text-[11px] text-white/50 list-decimal pl-4 space-y-1">
                <li>Copy the script above.</li>
                <li>Open <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-[#fa586a] underline">leetcode.com</a> in another tab.</li>
                <li>Press <kbd className="px-1 bg-white/10 rounded font-mono text-[10px]">F12</kbd> → Click <strong className="text-white/70">Console</strong> → Paste & Press <kbd className="px-1 bg-white/10 rounded font-mono text-[10px]">Enter</kbd>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Tab 3: Session Cookie Sync ── */}
        {activeTab === "session" && (
          <form onSubmit={handleSessionSync} className="space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Paste your <span className="text-white/80 font-mono">LEETCODE_SESSION</span> cookie from browser DevTools:
            </p>

            <div>
              <div className="flex items-center justify-between mb-1 pl-1">
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  Session Cookie
                </label>
                <button
                  type="button"
                  onClick={() => setShowCookieGuide(!showCookieGuide)}
                  className="text-[11px] text-[#fa586a] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>How to find cookie</span>
                </button>
              </div>

              {showCookieGuide && (
                <div className="mb-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] text-white/60 space-y-1.5">
                  <div className="font-bold text-white">How to get your session cookie:</div>
                  <ol className="list-decimal pl-4 space-y-1 text-white/50">
                    <li>Open <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-[#fa586a] underline">leetcode.com</a> and login.</li>
                    <li>Press <kbd className="px-1 bg-white/10 rounded font-mono">F12</kbd> → <strong className="text-white/70">Application</strong> → <strong className="text-white/70">Cookies</strong>.</li>
                    <li>Copy value of <code className="text-[#fa586a] font-mono">LEETCODE_SESSION</code>.</li>
                  </ol>
                </div>
              )}

              <input
                type="text"
                value={sessionCookie}
                onChange={(e) => setSessionCookie(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono"
              />
            </div>

            {error && <div className="text-xs text-[#ff453a] font-medium bg-[#ff453a]/10 p-3 rounded-xl border border-[#ff453a]/20">{error}</div>}
            {success && <div className="text-xs text-[#30d158] font-medium bg-[#30d158]/10 p-3 rounded-xl border border-[#30d158]/20 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /><span>{success}</span></div>}

            <button
              type="submit"
              disabled={submitting || !sessionCookie.trim()}
              className="w-full py-2.5 rounded-xl bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-bold text-xs shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Importing Solved History...</span>
                </>
              ) : (
                <>
                  <span>Import History via Cookie</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
