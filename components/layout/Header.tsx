"use client";

import React, { useState } from "react";
import { Bell, BellRing, RefreshCw, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchOpen?: () => void;
}

export function Header({ onMenuToggle, onSearchOpen }: HeaderProps) {
  const [activeSegment, setActiveSegment] = useState<"squad" | "all">("squad");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  return (
    <header className="sticky top-0 z-20 px-4 md:px-8 py-3 flex items-center justify-between bg-surface-base/80 backdrop-blur-xl border-b border-white/[0.04]">
      {/* Left: Mobile controls + Online status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onSearchOpen}
          className="md:hidden p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Search problems"
        >
          <Search className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-white/40 text-xs">
          <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse" />
          <span className="font-medium text-white/70">Squad Online:</span>
          <span>4 friends active</span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2.5">
        {/* Segment Toggle (Apple Style) */}
        <div className="flex items-center p-0.5 bg-white/[0.04] rounded-full border border-white/[0.06] text-xs">
          <button
            onClick={() => setActiveSegment("squad")}
            className={cn(
              "px-3 py-1 rounded-full font-medium transition-all",
              activeSegment === "squad"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            )}
          >
            Squad
          </button>
          <button
            onClick={() => setActiveSegment("all")}
            className={cn(
              "px-3 py-1 rounded-full font-medium transition-all",
              activeSegment === "all"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            )}
          >
            All Sheets
          </button>
        </div>

        {/* Sync */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-white/40 hover:text-white transition-all disabled:opacity-50"
          title="Sync LeetCode Submissions"
          aria-label="Sync LeetCode Submissions"
        >
          <RefreshCw
            className={cn(
              "w-4 h-4",
              isSyncing && "animate-spin text-apple-accent"
            )}
          />
        </button>

        {/* Notifications */}
        <button
          onClick={toggleNotifications}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
            notificationsEnabled
              ? "bg-apple-accent/15 border-apple-accent/30 text-apple-accent"
              : "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/70"
          )}
          aria-label="Toggle push notifications"
        >
          {notificationsEnabled ? (
            <>
              <BellRing className="w-3.5 h-3.5 fill-apple-accent" />
              <span className="hidden md:inline">Alerts On</span>
            </>
          ) : (
            <>
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Enable Alerts</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
