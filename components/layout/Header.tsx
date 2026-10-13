"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchOpen?: () => void;
}

function breadcrumbFor(pathname: string | null): string {
  if (!pathname || pathname === "/") return "Arena";
  const seg = pathname.split("/").filter(Boolean);
  const head = seg[0] || "Arena";
  return head.charAt(0).toUpperCase() + head.slice(1);
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
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <nav aria-label="Breadcrumb" className="truncate text-sm text-text-secondary">
          {breadcrumbFor(pathname)}
        </nav>
        <button
          onClick={onSearchOpen}
          className="ml-2 hidden items-center gap-2 rounded-md px-2 py-1 text-sm text-text-tertiary transition-colors hover:text-text-primary md:flex"
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden lg:inline">Search</span>
          <kbd className="kbd hidden lg:inline-flex">⌘K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
          title="Sync LeetCode submissions"
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} strokeWidth={1.5} />
          <span className="hidden sm:inline">
            {isSyncing ? "Syncing…" : "Synced 4m ago"}
          </span>
        </button>
        <NotificationBell />
      </div>
    </header>
  );
}
