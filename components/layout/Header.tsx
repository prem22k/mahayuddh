"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellRing, RefreshCw, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSquadProfiles } from "@/lib/data/profiles";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchOpen?: () => void;
}

export function Header({ onMenuToggle, onSearchOpen }: HeaderProps) {
  const { profile, refreshProfile } = useAuth();
  const [squadCount, setSquadCount] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function loadSquadSize() {
      try {
        const data = await getSquadProfiles();
        setSquadCount(data.length);
      } catch (e) {
        // ignore
      }
    }
    loadSquadSize();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (profile?.leetcode_username) {
        await fetch("/api/sync/leetcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: profile.leetcode_username }),
        });
      }
      await refreshProfile();
    } catch (e) {
      console.warn("Sync error:", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    } else {
      setNotificationsEnabled(!notificationsEnabled);
    }
  };

  return (
    <header className="sticky top-0 z-20 px-4 md:px-8 py-3 flex items-center justify-between bg-black/60 backdrop-blur-xl border-b border-white/[0.04] select-none">
      {/* Left: Mobile controls + Real Squad Member Count */}
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

        {squadCount !== null && (
          <div className="hidden sm:flex items-center gap-2 text-white/40 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#30d158]" />
            <span className="font-medium text-white/70">
              {squadCount} {squadCount === 1 ? "squad member" : "squad members"}
            </span>
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2.5">
        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/40 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
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

        {/* Notifications */}
        <button
          onClick={toggleNotifications}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer",
            notificationsEnabled
              ? "bg-[#fa586a]/15 border-[#fa586a]/30 text-[#fa586a]"
              : "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/70"
          )}
          aria-label="Toggle push notifications"
        >
          {notificationsEnabled ? (
            <>
              <BellRing className="w-3 h-3 fill-[#fa586a]" />
              <span className="hidden md:inline">Alerts On</span>
            </>
          ) : (
            <>
              <Bell className="w-3 h-3" />
              <span className="hidden md:inline">Alerts</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
