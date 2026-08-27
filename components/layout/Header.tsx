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
    <header className="h-14 sticky top-0 z-20 glass-panel border-b border-border-subtle flex items-center justify-between px-4 md:px-8">
      {/* Left: Mobile Drawer Trigger + Search Input */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-surface-raised transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onSearchOpen}
          className="md:hidden p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-surface-raised transition-colors"
          aria-label="Search problems"
        >
          <Search className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-txt-secondary text-xs">
          <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse-subtle" />
          <span className="font-medium text-txt-primary">Squad Online:</span>
          <span>4 friends active</span>
        </div>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-3">
        {/* Segment Pill Toggle (Apple Style) */}
        <div className="flex items-center p-0.5 bg-surface-muted rounded-pill border border-border-subtle text-xs">
          <button
            onClick={() => setActiveTabSafe("squad", setActiveSegment)}
            className={cn(
              "px-3 py-1 rounded-pill font-medium transition-all",
              activeSegment === "squad"
                ? "bg-surface-strong text-txt-primary shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            Squad
          </button>
          <button
            onClick={() => setActiveTabSafe("all", setActiveSegment)}
            className={cn(
              "px-3 py-1 rounded-pill font-medium transition-all",
              activeSegment === "all"
                ? "bg-surface-strong text-txt-primary shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            All Sheets
          </button>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="p-2 rounded-pill bg-surface-muted hover:bg-surface-raised border border-border-subtle text-txt-secondary hover:text-txt-primary transition-all disabled:opacity-50"
          title="Sync LeetCode Submissions"
          aria-label="Sync LeetCode Submissions"
        >
          <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin text-apple-accent")} />
        </button>

        {/* Push Notifications Toggle */}
        <button
          onClick={toggleNotifications}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-pill border text-xs font-medium transition-all",
            notificationsEnabled
              ? "bg-apple-accent/15 border-apple-accent/40 text-apple-accent"
              : "bg-surface-muted border-border-subtle text-txt-secondary hover:text-txt-primary"
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

function setActiveTabSafe(tab: "squad" | "all", setter: (v: "squad" | "all") => void) {
  setter(tab);
}
