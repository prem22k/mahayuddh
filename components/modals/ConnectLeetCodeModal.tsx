"use client";

import React, { useState } from "react";
import { X, Link2, Sparkles, Key, HelpCircle, Check, ArrowRight } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"handle" | "session">("handle");
  const [username, setUsername] = useState(profile?.leetcode_username || "");
  const [password, setPassword] = useState("");
  const [sessionCookie, setSessionCookie] = useState("");
  const [showCookieGuide, setShowCookieGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Instant Handle Sync (No password required, 100% reliable)
  const handleInstantSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !username.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await syncUserProfileStats(user.id, username.trim());
      if (!updated) {
        setError("Could not find LeetCode account. Please check the spelling of your username.");
        return;
      }

      await refreshProfile();
      setSuccess(`Connected @${username.trim()}! Contest rating, streak, and stats synced.`);
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

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 select-none">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#fa586a]/15 border border-[#fa586a]/30 flex items-center justify-center text-[#fa586a]">
              <Link2 className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-white">Connect LeetCode</h2>
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
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.04] rounded-2xl border border-white/[0.06] my-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("handle");
              setError(null);
            }}
            className={cn(
              "py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
              activeTab === "handle"
                ? "bg-[#fa586a] text-white shadow-sm"
                : "text-white/50 hover:text-white"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Handle (Fast)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("session");
              setError(null);
            }}
            className={cn(
              "py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
              activeTab === "session"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/50 hover:text-white"
            )}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Full History (Advanced)</span>
          </button>
        </div>

        {/* ── Tab 1: Instant Handle Connect ── */}
        {activeTab === "handle" && (
          <form onSubmit={handleInstantSync} className="space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Sync your <span className="text-white/80 font-semibold">live contest rating, global rank, daily streak, and problem breakdown</span> instantly. No password required!
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

        {/* ── Tab 2: Full History Session Sync ── */}
        {activeTab === "session" && (
          <form onSubmit={handleSessionSync} className="space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Import all historical solved questions into your roadmap trackers. Paste your <span className="text-white/80 font-mono">LEETCODE_SESSION</span> cookie from browser DevTools:
            </p>

            <div>
              <div className="flex items-center justify-between mb-1 pl-1">
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  LeetCode Session Cookie
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
                  <div className="font-bold text-white">How to get your session cookie in 30 seconds:</div>
                  <ol className="list-decimal pl-4 space-y-1 text-white/50">
                    <li>Open <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-[#fa586a] underline">leetcode.com</a> and make sure you are logged in.</li>
                    <li>Press <kbd className="px-1 bg-white/10 rounded font-mono">F12</kbd> (or Right Click → Inspect).</li>
                    <li>Go to <strong className="text-white/70">Application</strong> → <strong className="text-white/70">Cookies</strong> → <code className="text-white/70 font-mono">https://leetcode.com</code>.</li>
                    <li>Double-click the value of <code className="text-[#fa586a] font-mono">LEETCODE_SESSION</code>, copy, and paste below.</li>
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

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/[0.08]"></div>
              <span className="flex-shrink mx-3 text-[10px] text-white/30 uppercase font-bold tracking-wider">Or Login Credentials</span>
              <div className="flex-grow border-t border-white/[0.08]"></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
              />
            </div>

            {error && <div className="text-xs text-[#ff453a] font-medium bg-[#ff453a]/10 p-3 rounded-xl border border-[#ff453a]/20">{error}</div>}
            {success && <div className="text-xs text-[#30d158] font-medium bg-[#30d158]/10 p-3 rounded-xl border border-[#30d158]/20 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /><span>{success}</span></div>}

            <button
              type="submit"
              disabled={submitting || (!sessionCookie.trim() && (!username.trim() || !password.trim()))}
              className="w-full py-2.5 rounded-xl bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-bold text-xs shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Importing Solved History...</span>
                </>
              ) : (
                <>
                  <span>Import Full Solved History</span>
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
