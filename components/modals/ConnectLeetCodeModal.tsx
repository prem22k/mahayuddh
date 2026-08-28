"use client";

import React, { useState } from "react";
import { X, Link2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface ConnectLeetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export function ConnectLeetCodeModal({ isOpen, onClose, onConnected }: ConnectLeetCodeModalProps) {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
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
          Authorization: `Bearer ${(await user.getIdToken?.()) ?? ""}`,
        },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to connect LeetCode.");
        return;
      }

      setSuccess(`Imported ${json.imported ?? 0} solved problems. Your history is now synced.`);
      setPassword("");
      onConnected?.();
    } catch (err) {
      console.error("Connect LeetCode error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-white">Connect LeetCode</h2>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-white/40 mb-5">
          Import your <span className="text-white/70 font-semibold">complete solved history</span> so progress is accurate.
          Credentials are sent to our server only to mint a session; your password is never stored.
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
              LeetCode Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_leetcode_handle"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
              LeetCode Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs leading-relaxed">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-2xl bg-[#30d158]/10 border border-[#30d158]/25 text-[#30d158] text-xs leading-relaxed">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white/[0.04] text-white/50 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-semibold shadow-glow transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              {submitting ? "Importing..." : "Connect & Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
