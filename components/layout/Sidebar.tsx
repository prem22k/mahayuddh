"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Search,
  Home,
  Trophy,
  Inbox,
  BookOpen,
  FolderPlus,
  Compass,
  Code2,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { getAllLists } from "@/lib/data/sheets";
import { CustomList } from "@/types/database";

interface SidebarProps {
  onSearchOpen?: () => void;
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
  const pathname = usePathname();
  const { profile, user, signOut } = useAuth();
  const [lists, setLists] = useState<CustomList[]>([]);

  useEffect(() => {
    async function loadLists() {
      try {
        const data = await getAllLists();
        setLists(data);
      } catch (err) {
        console.error("Error loading lists in sidebar:", err);
      }
    }
    loadLists();
  }, []);

  const coreNav = [
    { name: "Arena", href: "/", icon: Home },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Suggestions", href: "/suggestions", icon: Inbox },
    { name: "Vault", href: "/vault", icon: Code2 },
  ];

  const curatedRoadmaps = lists.filter((l) => l.is_curated);
  const squadLists = lists.filter((l) => !l.is_curated);

  const displayName = profile?.username || user?.email?.split("@")[0] || "Squad Member";
  const displayHandle = profile?.leetcode_username || "anonymous";
  const displayStreak = profile?.streak || 0;

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 bg-surface-sidebar border-r border-border-subtle flex flex-col justify-between z-30 select-none">
      {/* Top Header & Search */}
      <div className="flex flex-col">
        {/* Brand */}
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-border-subtle/50">
          <div className="w-7 h-7 rounded-lg bg-apple-accent flex items-center justify-center text-white shadow-glow font-bold text-sm">
            ⚔️
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] tracking-tight text-txt-primary leading-tight">
              Mahayuddh
            </span>
            <span className="text-[10px] text-txt-secondary font-medium tracking-wider uppercase">
              Developer Arena
            </span>
          </div>
        </div>

        {/* Search Pill Trigger */}
        <div className="p-3">
          <button
            onClick={onSearchOpen}
            className="w-full h-9 px-3 bg-surface-muted hover:bg-surface-raised border border-border-subtle hover:border-apple-accent/40 rounded-pill flex items-center justify-between text-txt-secondary transition-all group focus-visible:ring-2 focus-visible:ring-apple-accent cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-txt-secondary group-hover:text-apple-accent transition-colors" />
              <span className="text-xs group-hover:text-txt-primary transition-colors">
                Search problems...
              </span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-base/80 rounded border border-border-subtle text-txt-secondary">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="px-2 space-y-4 overflow-y-auto max-h-[calc(100vh-210px)] pb-4">
          {/* Core Arena */}
          <div>
            <div className="px-3 py-1 text-[10px] font-semibold text-txt-tertiary tracking-wider uppercase">
              Arena
            </div>
            <nav className="mt-1 space-y-0.5">
              {coreNav.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-apple-accent text-white font-semibold"
                        : "text-txt-secondary hover:text-txt-primary hover:bg-surface-raised"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Curated Roadmaps */}
          <div>
            <div className="px-3 py-1 text-[10px] font-semibold text-txt-tertiary tracking-wider uppercase flex items-center justify-between">
              <span>Roadmaps</span>
              <Compass className="w-3 h-3" />
            </div>
            <nav className="mt-1 space-y-0.5">
              {curatedRoadmaps.length === 0 ? (
                <div className="px-3 py-1 text-[11px] text-txt-tertiary">
                  Loading roadmaps...
                </div>
              ) : (
                curatedRoadmaps.map((item) => {
                  const href = `/sheets/${item.slug}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      className={cn(
                        "flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] font-normal transition-colors",
                        isActive
                          ? "bg-surface-raised text-txt-primary font-medium border-l-2 border-apple-accent"
                          : "text-txt-secondary hover:text-txt-primary hover:bg-surface-raised/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <BookOpen className="w-3.5 h-3.5 opacity-80 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </nav>
          </div>

          {/* Squad Lists */}
          {squadLists.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold text-txt-tertiary tracking-wider uppercase flex items-center justify-between">
                <span>Squad Lists</span>
                <FolderPlus className="w-3 h-3" />
              </div>
              <nav className="mt-1 space-y-0.5">
                {squadLists.map((item) => {
                  const href = `/sheets/${item.slug}`;
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      className="flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] text-txt-secondary hover:text-txt-primary hover:bg-surface-raised/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-xs">{item.emoji || "📁"}</span>
                        <span className="truncate">{item.title}</span>
                      </div>
                      <ChevronRight className="w-3 h-3 opacity-40" />
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* User Footer Profile & Sign Out */}
      <div className="p-3 border-t border-border-subtle/70 bg-surface-sidebar/90">
        <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border-subtle">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-surface-raised border border-border-subtle flex items-center justify-center font-bold text-xs text-txt-primary shrink-0">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-txt-primary truncate leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] text-txt-secondary truncate leading-tight font-mono">
                @{displayHandle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Streak Flame */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-apple-accent/15 border border-apple-accent/30 text-apple-accent">
              <Flame className="w-3 h-3 fill-apple-accent" />
              <span className="text-[10px] font-bold">{displayStreak}d</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-txt-tertiary hover:text-apple-red hover:bg-surface-raised transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
