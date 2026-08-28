"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  LayoutGrid,
  Trophy,
  MessageSquare,
  Bookmark,
  LogOut,
  ChevronRight,
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
    { name: "Arena", href: "/", icon: LayoutGrid },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Suggestions", href: "/suggestions", icon: MessageSquare },
    { name: "Vault", href: "/vault", icon: Bookmark },
  ];

  const curatedRoadmaps = lists.filter((l) => l.is_curated);
  const squadLists = lists.filter((l) => !l.is_curated);

  const displayName =
    profile?.username || user?.email?.split("@")[0] || "Squad Member";
  const displayHandle = profile?.leetcode_username || "anonymous";
  const displayStreak = profile?.streak || 0;

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* ── Brand Header ── */}
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

      {/* ── Search Trigger ── */}
      <div className="px-3 pb-3">
        <button
          onClick={onSearchOpen}
          className="w-full h-8 px-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-[#fa586a]/30 rounded-[10px] flex items-center justify-between text-white/40 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 group-hover:text-[#fa586a] transition-colors" />
            <span className="text-[12px] group-hover:text-white/70 transition-colors">
              Search problems...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.04] rounded border border-white/[0.06] text-white/25">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── Scrollable Navigation ── */}
      <div className="flex-1 overflow-y-auto px-2 space-y-5 pb-3">
        {/* Core Navigation */}
        <div>
          <div className="nav-section-label">Main</div>
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
                  <Icon className={cn("nav-icon w-[16px] h-[16px]")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Curated Roadmaps (Apple Music Playlist Style) */}
        <div>
          <div className="nav-section-label">Roadmaps</div>
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
                    <span className="truncate flex-1">{item.title}</span>
                    <ChevronRight className="w-3 h-3 text-white/20" />
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* ── Profile Footer ── */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#fa586a] to-[#ff8a9c] flex items-center justify-center font-bold text-[10px] text-white shrink-0">
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
              <span className="text-[10px] text-white/35 truncate leading-tight font-mono">
                @{displayHandle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Clean Streak Badge */}
            <div className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/80 font-mono text-[10px] font-semibold">
              {displayStreak}d
            </div>

            {/* Sign Out */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
