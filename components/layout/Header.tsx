"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { StreakChip } from "@/components/ui/Badge";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchOpen?: () => void;
}

// Section names follow the sidebar, not the URL: /home is the Arena.
const SECTION_NAMES: Record<string, string> = {
  home: "Arena",
  practice: "Practice",
  squad: "Squad",
  feed: "Feed",
  challenges: "Challenges",
  leaderboard: "Leaderboard",
  notebook: "Notebook",
  vault: "Notebook",
  sheets: "Sheets",
  patterns: "Patterns",
  primers: "Primers",
  stuck: "Stuck requests",
  approach: "Approach",
  profile: "Profile",
  validation: "Quality gates",
  welcome: "Welcome",
  // Short public routes: /u profile, /b proof, /c challenge, /a approach.
  u: "Profile",
  b: "Proof",
  c: "Challenge",
  a: "Approach",
};

function breadcrumbFor(pathname: string | null): string {
  if (!pathname || pathname === "/") return "Arena";
  const head = pathname.split("/").filter(Boolean)[0] || "home";
  return SECTION_NAMES[head] ?? head.charAt(0).toUpperCase() + head.slice(1);
}

/** Honest relative sync label from the profile row (never hardcoded). */
function syncLabel(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  return `Synced ${Math.floor(hrs / 24)}d ago`;
}

export function Header({ onMenuToggle, onSearchOpen }: HeaderProps) {
  const pathname = usePathname();
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
    <header className="shell-header select-none">
      {/* Mobile S2: wordmark left, streak + search + bell + menu right. */}
      <Link href="/home" className="flex items-center gap-2 md:hidden" aria-label="Mahayuddh home">
        <span className="font-display text-[17px] font-semibold tracking-tight text-text-primary">
          Mahayuddh
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      </Link>

      <nav
        aria-label="Breadcrumb"
        className="hidden min-w-0 truncate text-sm font-medium text-text-primary md:block"
      >
        {breadcrumbFor(pathname)}
      </nav>

      <div className="flex shrink-0 items-center gap-1 md:gap-3">
        <StreakChip count={profile?.streak ?? 0} alive={false} className="mr-1 md:hidden" />
        <button
          type="button"
          onClick={onSearchOpen}
          className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="hidden h-8 items-center gap-2 rounded-md border border-hairline px-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 md:flex"
          title="Sync LeetCode submissions"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", profile?.last_synced_at ? "text-verified" : "text-text-tertiary", isSyncing && "animate-spin")}
            strokeWidth={1.75}
          />
          <span>{isSyncing ? "Syncing…" : syncLabel(profile?.last_synced_at ?? null)}</span>
        </button>
        <NotificationBell />
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
