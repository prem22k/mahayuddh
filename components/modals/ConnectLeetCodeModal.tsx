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
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { FormAlert } from "@/components/ui/FormAlert";

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
  const [removingSession, setRemovingSession] = useState(false);

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
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
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
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.8 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
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

  const handleCopySnippet = async () => {
    if (!(await copyText(consoleSnippet))) return;
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const handleRemoveSession = async () => {
    if (!user) return;
    setRemovingSession(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/leetcode-history", {
        method: "DELETE",
        headers: {
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
        },
      });
      if (!res.ok) {
        setError("Couldn't remove the stored session. Try again.");
        return;
      }
      setSuccess("Stored LeetCode session removed. Your squads, notes, and history are untouched — only the evidence badge is gone.");
      await refreshProfile();
    } catch {
      setError("Couldn't remove the stored session. Try again.");
    } finally {
      setRemovingSession(false);
    }
  };

  return (
    <ModalShell
      label="Sync LeetCode status"
      onClose={onClose}
      zIndexClass="z-[350]"
      panelClassName="shadow-overlay p-6 max-h-[90vh] overflow-y-auto"
    >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-tint border border-primary/30 flex items-center justify-center text-primary">
              <Link2 className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Sync LeetCode Status</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <p className="text-[11px] text-text-secondary leading-relaxed mb-3">
          Optional enhancement — Mahayuddh works fully without LeetCode. Connecting adds contest stats + solve evidence badges.{" "}
          <button type="button" onClick={handleRemoveSession} disabled={removingSession} className="text-primary hover:underline font-semibold cursor-pointer">
            {removingSession ? "Removing…" : "Remove stored session"}
          </button>
        </p>
        <div className="grid grid-cols-3 gap-1 p-1 bg-well rounded-2xl border border-hairline my-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("handle");
              setError(null);
            }}
            className={cn(
              "py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1",
              activeTab === "handle"
                ? "bg-primary text-on-primary hover:bg-primary-hover shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
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
                ? "bg-verified text-on-primary shadow-sm font-bold"
                : "text-text-tertiary hover:text-text-primary"
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
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
            )}
          >
            <Key className="w-3 h-3" />
            <span>Session</span>
          </button>
        </div>

        {/* ── Tab 1: Instant Handle Connect ── */}
        {activeTab === "handle" && (
          <form onSubmit={handleInstantSync} className="space-y-4">
            <p className="text-xs text-text-tertiary leading-relaxed">
              Sync your <strong className="text-text-primary">contest rating, global rank, daily streak, and last 100 accepted problems</strong> automatically.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 pl-1">
                LeetCode Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. your_handle"
                className="w-full bg-well border border-hairline rounded-xl p-2.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/60 font-mono"
                required
                autoFocus
              />
            </div>

            {error && <FormAlert tone="error">{error}</FormAlert>}
            {success && <FormAlert tone="success">{success}</FormAlert>}

            <button
              type="submit"
              disabled={submitting || !username.trim()}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-bold text-xs shadow-lifted transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" tone="inverse" />
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
            <div className="p-3.5 rounded-2xl bg-verified-tint border border-verified/20 text-xs text-verified space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                <span>Zero Passwords • 1-Click Full History Sync</span>
              </div>
              <p className="text-[11px] text-text-secondary">
                Syncs all 500+ of your past solved questions into your roadmaps directly from your logged-in browser tab.
              </p>
            </div>

            {/* Method A: Drag Bookmarklet */}
            <div className="p-4 rounded-2xl bg-surface-overlay border border-hairline space-y-2.5">
              <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-primary" />
                <span>Option 1: Drag to Bookmarks Bar</span>
              </div>
              <p className="text-[11px] text-text-secondary">
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-lifted cursor-grab active:cursor-grabbing"
                  title="Drag me to your bookmarks toolbar!"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>⚡ Sync to Mahayuddh</span>
                </a>
              </div>
            </div>

            {/* Method B: Console Snippet */}
            <div className="p-4 rounded-2xl bg-surface-overlay border border-hairline space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Option 2: 1-Click Console Snippet</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="px-2.5 py-1 rounded-lg bg-surface-overlay hover:bg-surface-raised text-[11px] font-bold text-text-primary flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3 h-3 text-verified" />
                      <span className="text-verified">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              </div>

              <ol className="text-[11px] text-text-tertiary list-decimal pl-4 space-y-1">
                <li>Copy the script above.</li>
                <li>Open <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-primary underline">leetcode.com</a> in another tab.</li>
                <li>Press <kbd className="px-1 bg-surface-overlay rounded font-mono text-[10px]">F12</kbd> → Click <strong className="text-text-secondary">Console</strong> → Paste & Press <kbd className="px-1 bg-surface-overlay rounded font-mono text-[10px]">Enter</kbd>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Tab 3: Session Cookie Sync ── */}
        {activeTab === "session" && (
          <form onSubmit={handleSessionSync} className="space-y-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              Paste your <span className="text-text-secondary font-mono">LEETCODE_SESSION</span> cookie from browser DevTools:
            </p>

            <div>
              <div className="flex items-center justify-between mb-1 pl-1">
                <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                  Session Cookie
                </label>
                <button
                  type="button"
                  onClick={() => setShowCookieGuide(!showCookieGuide)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>How to find cookie</span>
                </button>
              </div>

              {showCookieGuide && (
                <div className="mb-2.5 p-3 rounded-xl bg-surface-overlay border border-hairline text-[11px] text-text-secondary space-y-1.5">
                  <div className="font-bold text-text-primary">How to get your session cookie:</div>
                  <ol className="list-decimal pl-4 space-y-1 text-text-tertiary">
                    <li>Open <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-primary underline">leetcode.com</a> and login.</li>
                    <li>Press <kbd className="px-1 bg-surface-overlay rounded font-mono">F12</kbd> → <strong className="text-text-secondary">Application</strong> → <strong className="text-text-secondary">Cookies</strong>.</li>
                    <li>Copy value of <code className="text-primary font-mono">LEETCODE_SESSION</code>.</li>
                  </ol>
                </div>
              )}

              <input
                type="text"
                value={sessionCookie}
                onChange={(e) => setSessionCookie(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full bg-well border border-hairline rounded-xl p-2.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/60 font-mono"
              />
            </div>

            {error && <FormAlert tone="error">{error}</FormAlert>}
            {success && <FormAlert tone="success">{success}</FormAlert>}

            <button
              type="submit"
              disabled={submitting || !sessionCookie.trim()}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-bold text-xs shadow-lifted transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" tone="inverse" />
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
    </ModalShell>
  );
}
