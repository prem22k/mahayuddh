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

  const displayName =
    profile?.username || user?.email?.split("@")[0] || "Squad Member";
  const displayHandle = profile?.leetcode_username || "anonymous";
  const displayStreak = profile?.streak || 0;

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* ── Brand Header ───────────────────────────────── */}
      <div className="px-5 pt-5 pb-3">
        <Link href="/" className="flex flex-col group">
          <span className="font-black text-[18px] tracking-[-0.04em] text-white leading-tight">
            Mahayuddh
            <span className="text-[#fa586a] drop-shadow-[0_0_12px_rgba(250,88,106,0.8)]">
              .
            </span>
          </span>
          <span className="text-[10px] text-white/35 font-medium tracking-[0.16em] uppercase mt-0.5">
            Developer Arena
          </span>
        </Link>
      </div>

      {/* ── Search Trigger ─────────────────────────────── */}
      <div className="px-3 pb-3">
        <button
          onClick={onSearchOpen}
          className="w-full h-8 px-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-apple-accent/30 rounded-[10px] flex items-center justify-between text-white/40 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 group-hover:text-apple-accent transition-colors" />
            <span className="text-[12px] group-hover:text-white/60 transition-colors">
              Search problems...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.04] rounded border border-white/[0.06] text-white/25">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── Scrollable Navigation ──────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 space-y-5 pb-3">
        {/* Core Arena */}
        <div>
          <div className="nav-section-label">Arena</div>
          <nav className="space-y-0.5">
            {coreNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn("nav-item", isActive && "active")}
                >
                  <Icon className={cn("nav-icon w-[18px] h-[18px]")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Curated Roadmaps */}
        <div>
          <div className="nav-section-label flex items-center justify-between">
            <span>Roadmaps</span>
            <Compass className="w-3 h-3 text-white/20" />
          </div>
          <nav className="space-y-0.5">
            {curatedRoadmaps.length === 0 ? (
              <div className="px-3 py-1.5 text-[11px] text-white/25">
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
                      "nav-item",
                      isActive && "active",
                      !isActive && "font-normal"
                    )}
                  >
                    <BookOpen className="nav-icon w-[15px] h-[15px]" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })
            )}
          </nav>
        </div>

        {/* Squad Lists */}
        {squadLists.length > 0 && (
          <div>
            <div className="nav-section-label">Squad Lists</div>
            <nav className="space-y-0.5">
              {squadLists.map((item) => {
                const href = `/sheets/${item.slug}`;
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className="nav-item font-normal"
                  >
                    <span className="text-xs">{item.emoji || "📁"}</span>
                    <span className="truncate flex-1">{item.title}</span>
                    <ChevronRight className="w-3 h-3 text-white/20" />
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* ── Profile Footer ─────────────────────────────── */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apple-accent to-[#ff8a9c] flex items-center justify-center font-bold text-[11px] text-white shrink-0">
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
              <span className="text-[12px] font-semibold text-white truncate leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] text-white/35 truncate leading-tight font-mono">
                @{displayHandle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Streak Badge */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-apple-accent/15 border border-apple-accent/25 text-apple-accent">
              <Flame className="w-3 h-3 fill-apple-accent" />
              <span className="text-[10px] font-bold">{displayStreak}d</span>
            </div>

            {/* Sign Out */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-white/25 hover:text-apple-red hover:bg-white/[0.05] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
