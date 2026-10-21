"use client";

import React, { useEffect, useState } from "react";
import { X, Zap, CircleHelp, Check, Copy, ArrowRight, ExternalLink, Bookmark } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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

  // The modal stays mounted while closed, so the handle captured at mount can
  // predate the profile load. Fill it in on open if the field is still empty.
  const linkedHandle = profile?.leetcode_username || "";
  useEffect(() => {
    if (isOpen && linkedHandle) setUsername((u) => u || linkedHandle);
  }, [isOpen, linkedHandle]);

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

  const tabs = [
    { value: "handle", label: "Handle" },
    { value: "bookmarklet", label: "1-click sync" },
    { value: "session", label: "Session" },
  ] as const;
  const inputCls =
    "h-11 w-full rounded-md border border-hairline bg-well px-3 font-mono text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:h-10";
  const labelCls = "mb-1.5 block text-xs font-medium text-text-secondary";
  const cardCls = "space-y-2.5 rounded-lg border border-hairline bg-well p-4";
  const inlineLink = "text-text-primary underline decoration-hairline-strong underline-offset-2 hover:decoration-text-primary";

  return (
    <ModalShell
      label="Sync LeetCode status"
      onClose={onClose}
      zIndexClass="z-[350]"
      variant="sheet"
      maxWidthClass="max-w-[520px]"
      panelClassName="max-h-[90vh] overflow-y-auto p-5 max-md:pt-8 md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Sync LeetCode status
          </h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Optional. Mahayuddh works fully without LeetCode; connecting adds contest stats and
            verified solves.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary md:h-9 md:w-9"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <SegmentedControl
        label="How to connect"
        value={activeTab}
        onChange={(v) => {
          setActiveTab(v);
          setError(null);
        }}
        options={tabs}
        className="mt-4 border border-hairline max-md:h-auto"
      />

      <div className="mt-4 space-y-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}
        {success && <FormAlert tone="success">{success}</FormAlert>}

        {/* ── Tab 1: Instant Handle Connect ── */}
        {activeTab === "handle" && (
          <form onSubmit={handleInstantSync} className="space-y-4">
            <p className="text-xs leading-5 text-text-secondary">
              Syncs your <span className="text-text-primary">contest rating, global rank, daily streak, and last 100 accepted problems</span>.
            </p>

            <div>
              <label htmlFor="lc-handle" className={labelCls}>
                LeetCode username
              </label>
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-tertiary"
                >
                  leetcode.com/
                </span>
                <input
                  id="lc-handle"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_handle"
                  className={cn(inputCls, "pl-[112px]")}
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="full"
              loading={submitting}
              disabled={!username.trim()}
              className="h-11 md:h-10"
            >
              Connect and sync stats
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </Button>
          </form>
        )}

        {/* ── Tab 2: 1-Click Browser Sync (Zero-Friction) ── */}
        {activeTab === "bookmarklet" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-hairline bg-surface p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <Zap className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} aria-hidden />
                No passwords · full history sync
              </p>
              <p className="mt-1 text-[11px] leading-4 text-text-secondary">
                Imports every problem you&apos;ve solved into your sheets, straight from a
                browser tab where you&apos;re signed in to LeetCode.
              </p>
            </div>

            {/* Method A: Drag Bookmarklet */}
            <div className={cardCls}>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <Bookmark className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} aria-hidden />
                Option 1: drag to your bookmarks bar
              </p>
              <p className="text-[11px] leading-4 text-text-secondary">
                Drag this button to your bookmarks bar once. Then click it while you&apos;re on LeetCode.
              </p>
              <div className="pt-1">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a
                  href={bookmarkletCode}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Drag this button to your browser bookmarks bar (Ctrl+Shift+B)!");
                  }}
                  className="inline-flex h-10 cursor-grab items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover active:cursor-grabbing"
                  title="Drag me to your bookmarks toolbar!"
                >
                  <Zap className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  <span>Sync to Mahayuddh</span>
                </a>
              </div>
            </div>

            {/* Method B: Console Snippet */}
            <div className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <ExternalLink className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} aria-hidden />
                  Option 2: console snippet
                </p>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-8"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                      <span>Copy script</span>
                    </>
                  )}
                </button>
              </div>

              <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-4 text-text-tertiary">
                <li>Copy the script.</li>
                <li>
                  Open{" "}
                  <a href="https://leetcode.com" target="_blank" rel="noreferrer" className={inlineLink}>
                    leetcode.com
                  </a>{" "}
                  in another tab.
                </li>
                <li>
                  Press <kbd className="kbd">F12</kbd>, open <span className="text-text-secondary">Console</span>,
                  paste, and press <kbd className="kbd">Enter</kbd>.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Tab 3: Session Cookie Sync ── */}
        {activeTab === "session" && (
          <form onSubmit={handleSessionSync} className="space-y-4">
            <p className="text-xs leading-5 text-text-secondary">
              Paste your <span className="font-mono text-text-primary">LEETCODE_SESSION</span> cookie
              from your browser&apos;s DevTools to import your full history.
            </p>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="lc-session" className="text-xs font-medium text-text-secondary">
                  Session cookie
                </label>
                <button
                  type="button"
                  onClick={() => setShowCookieGuide(!showCookieGuide)}
                  aria-expanded={showCookieGuide}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-[11px] font-medium text-text-secondary underline decoration-hairline-strong underline-offset-2 hover:text-text-primary md:min-h-0"
                >
                  <CircleHelp className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                  <span>How to find it</span>
                </button>
              </div>

              {showCookieGuide && (
                <div className="mb-2.5 space-y-1.5 rounded-lg border border-hairline bg-well p-3 text-[11px] leading-4 text-text-secondary">
                  <p className="font-semibold text-text-primary">How to get your session cookie</p>
                  <ol className="list-decimal space-y-1 pl-4 text-text-tertiary">
                    <li>
                      Open{" "}
                      <a href="https://leetcode.com" target="_blank" rel="noreferrer" className={inlineLink}>
                        leetcode.com
                      </a>{" "}
                      and sign in.
                    </li>
                    <li>
                      Press <kbd className="kbd">F12</kbd>, then <span className="text-text-secondary">Application</span> →{" "}
                      <span className="text-text-secondary">Cookies</span>.
                    </li>
                    <li>
                      Copy the value of <code className="font-mono text-text-primary">LEETCODE_SESSION</code>.
                    </li>
                  </ol>
                </div>
              )}

              <input
                id="lc-session"
                type="text"
                value={sessionCookie}
                onChange={(e) => setSessionCookie(e.target.value)}
                placeholder="eyJhbGciOi..."
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="full"
              loading={submitting}
              disabled={!sessionCookie.trim()}
              className="h-11 md:h-10"
            >
              Import history via cookie
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </Button>
          </form>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-hairline pt-4">
        <p className="text-[11px] leading-4 text-text-tertiary">
          Stored a session for history import? You can remove it any time.
        </p>
        <button
          type="button"
          onClick={handleRemoveSession}
          disabled={removingSession}
          className="inline-flex min-h-[44px] cursor-pointer items-center text-xs font-medium text-text-secondary underline decoration-hairline-strong underline-offset-2 transition-colors hover:text-error disabled:cursor-wait md:min-h-0"
        >
          {removingSession ? "Removing…" : "Remove stored session"}
        </button>
      </div>
    </ModalShell>
  );
}
