"use client";

import React, { useState } from "react";
import { Bell, BellRing, RefreshCw, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";

import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";

interface HeaderProps {
  onMenuToggle?: () => void;
  onSearchOpen?: () => void;
}

export function Header({ onMenuToggle, onSearchOpen }: HeaderProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const displayName = profile?.username || user?.email?.split("@")[0] || "Squad Member";

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

  const toggleNotifications = async () => {
    if (!notificationsEnabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    } else {
      setNotificationsEnabled(!notificationsEnabled);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 px-4 md:px-8 py-3 flex items-center justify-between bg-black/60 backdrop-blur-xl border-b border-white/[0.04] select-none">
        {/* Left: Mobile controls + Currently Active User */}
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

          {/* Currently Active User Display - Clickable to open Dossier */}
          {profile && (
            <button
              onClick={() => setIsDossierOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-[#fa586a]/40 transition-all cursor-pointer group"
              title="Click to view your Warrior Stats Dossier & Combat Radar"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#fa586a] to-[#ff8a9c] flex items-center justify-center font-bold text-[9px] text-white shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
                <span className="font-semibold text-white/90 group-hover:text-white truncate max-w-[130px]">{displayName}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#fa586a]">Dossier</span>
              </div>
            </button>
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

    <UserStatsDossierModal
      isOpen={isDossierOpen}
      onClose={() => setIsDossierOpen(false)}
      profile={profile}
    />
  </>
  );
}
