"use client";

import React, { useState } from "react";
import { RefreshCw, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchOpen?: () => void;
}

/**
 * The utility bar (design.md §2).
 *
 * Three things live here and nothing else: the global search, the LeetCode sync
 * trigger, and notifications. Identity is NOT here — the sidebar footer already
 * carries avatar, handle, streak and sign-out, and a second copy of the same
 * person in the bar was the reason "who am I" appeared three times per screen.
 * The dossier opens from the sidebar footer instead.
 *
 * There is exactly one notification control. A separate "Alerts" permission
 * pill used to sit beside the real bell, and because the bell was mounted as a
 * fixed overlay in the same corner the two were drawn on top of each other:
 * unread state and push permission were both unreachable. Permission now lives
 * inside the bell's own panel, where it belongs.
 */
export function Header({ onMenuToggle, onSearchOpen }: HeaderProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (profile?.leetcode_username && user) {
        await syncUserProfileStats(user.id, profile.leetcode_username);
      }
      await refreshProfile();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  return (
    <header className="sticky top-0 z-20 px-4 md:px-8 py-2 md:py-3 flex items-center justify-between gap-3 bg-black/90 backdrop-blur-xl border-b border-white/[0.06] select-none">
      {/* Left: mobile drawer + global search */}
      <div className="flex items-center gap-1.5 md:gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuToggle}
          className="md:hidden w-11 h-11 shrink-0 -ml-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center justify-center cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* design.md §2 puts the search pill in the header. The sidebar keeps its
            own trigger (§3.1); on a phone this one replaces it, since the
            drawer is a worse search entry than a visible field. */}
        <button
          onClick={onSearchOpen}
          className="group h-11 md:h-9 px-3 w-full max-w-md bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-[#fa586a]/30 rounded-[10px] flex items-center justify-between gap-3 text-white/70 transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 shrink-0 group-hover:text-[#fa586a] transition-colors" />
            <span className="text-[12px] truncate group-hover:text-white/70 transition-colors">
              Search problems, tags, squad members
            </span>
          </span>
          <kbd className="hidden sm:block shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.04] rounded border border-white/[0.06] text-white/25">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: sync + notifications */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
          title="Sync LeetCode Submissions"
          aria-label="Sync LeetCode Submissions"
        >
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5",
              isSyncing && "animate-spin text-[#fa586a]"
            )}
          />
        </button>

        <div className="flex items-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
