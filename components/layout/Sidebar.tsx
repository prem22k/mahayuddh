"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Swords,
  Code,
  Users,
  MessageSquareText,
  Trophy,
  ChartColumn,
  BookOpen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { CreateListModal } from "@/components/modals/CreateListModal";
import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip } from "@/components/ui/Badge";
import { useShellCounts } from "./useShellCounts";

interface SidebarProps {
  onSearchOpen?: () => void;
}

export const coreNav = [
  { name: "Arena", href: "/home", icon: Swords, aliases: ["/"] },
  { name: "Practice", href: "/practice", icon: Code, aliases: [] },
  { name: "Squad", href: "/squad", icon: Users, aliases: [] },
  { name: "Feed", href: "/feed", icon: MessageSquareText, aliases: [] },
  { name: "Challenges", href: "/challenges", icon: Trophy, aliases: ["/suggestions"] },
  { name: "Leaderboard", href: "/leaderboard", icon: ChartColumn, aliases: [] },
  { name: "Notebook", href: "/notebook", icon: BookOpen, aliases: ["/vault"] },
];

export function isNavActive(pathname: string | null, href: string, aliases: string[] = []) {
  if (!pathname) return false;
  if (pathname === href || aliases.includes(pathname)) return true;
  // Detail routes keep their section lit: /practice/two-sum is still Practice.
  return href !== "/home" && pathname.startsWith(`${href}/`);
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const { incomingChallenges, squadName, sheets } = useShellCounts();
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const displayName =
    profile?.username || user?.email?.split("@")[0] || "Squad Member";
  const displayHandle = (profile?.username || displayName)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const streak = profile?.streak ?? 0;

  return (
    <>
      <div className="flex h-full w-full select-none flex-col justify-between">
        <div className="flex min-h-0 flex-col overflow-y-auto px-3 pt-5">
          <Link
            href="/home"
            className="mb-5 flex items-center gap-2.5 px-3"
            aria-label="Mahayuddh home"
          >
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span className="sidebar-label font-display text-lg font-semibold tracking-tight text-text-primary">
              Mahayuddh
            </span>
          </Link>

          <button
            type="button"
            onClick={onSearchOpen}
            className="group mb-4 flex h-9 w-full items-center justify-between rounded-md border border-hairline bg-well px-3 text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary"
            aria-label="Search"
          >
            <span className="flex items-center gap-2.5">
              <Search
                className="h-4 w-4 text-text-tertiary transition-colors group-hover:text-text-secondary"
                strokeWidth={1.5}
              />
              <span className="sidebar-search-text text-sm font-medium leading-none">Search</span>
            </span>
            <kbd className="sidebar-search-text flex h-5 items-center rounded-xs border border-hairline bg-surface-overlay px-1.5 font-mono text-[11px] font-medium leading-none text-text-tertiary">
              ⌘K
            </kbd>
          </button>

          <nav className="flex flex-col gap-0.5" aria-label="Primary">
            {coreNav.map((item) => {
              const isActive = isNavActive(pathname, item.href, item.aliases);
              const Icon = item.icon;
              const count = item.name === "Challenges" ? incomingChallenges : 0;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={item.name}
                  className={cn("nav-item group", isActive && "active")}
                >
                  <Icon
                    className={cn(
                      "nav-icon h-[18px] w-[18px]",
                      isActive ? "text-primary" : "text-text-tertiary group-hover:text-text-secondary"
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="sidebar-label">{item.name}</span>
                  {count > 0 && (
                    <span
                      className="sidebar-label ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full border border-hairline bg-surface-overlay px-1.5 font-mono text-[11px] font-medium text-text-primary tnum"
                      aria-label={`${count} open for you`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-sheets pb-3">
            <div className="mb-2 mt-6 px-3 text-xs font-medium uppercase text-text-tertiary">
              Sheets
            </div>
            <nav className="flex flex-col gap-0.5" aria-label="Sheets">
              {sheets.map((s) => {
                const href = `/sheets/${s.slug}`;
                const isActive = pathname === href;
                const pct =
                  s.progress && s.progress.total > 0
                    ? Math.round((s.progress.solved / s.progress.total) * 100)
                    : null;
                return (
                  <Link
                    key={s.slug}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center justify-between rounded-md px-3 text-sm leading-none transition-colors",
                      isActive
                        ? "bg-surface-raised text-text-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    )}
                  >
                    <span className="truncate">{s.title}</span>
                    {pct !== null && (
                      <span className="font-mono text-[11px] text-text-tertiary tnum">{pct}%</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="border-t border-hairline bg-surface p-3">
          <button
            type="button"
            onClick={() => setIsDossierOpen(true)}
            className="group w-full rounded-lg border border-transparent bg-surface p-2.5 text-left transition-colors hover:border-hairline hover:bg-surface-raised"
            title="Open your dossier"
          >
            <span className="mb-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={displayName} src={profile?.avatar_url} size="md" className="border border-hairline" />
                <span className="sidebar-user-meta flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-semibold leading-tight text-text-primary transition-colors group-hover:text-primary-hover">
                    {displayName}
                  </span>
                  <span className="truncate text-[11px] leading-tight text-text-tertiary">
                    @{displayHandle}
                    {squadName ? ` · ${squadName}` : ""}
                  </span>
                </span>
              </span>
              <StreakChip count={streak} alive={false} className="sidebar-user-meta" />
            </span>
            {streak > 0 && (
              <span className="sidebar-user-meta flex items-center gap-1.5 border-t border-hairline px-0.5 pt-1.5 text-[11px] text-text-tertiary">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-primary/70" aria-hidden />
                <span className="truncate">Solve today to keep {streak}</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            aria-label="Sign out"
            className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-xs text-text-tertiary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="sidebar-label">Sign out</span>
          </button>
        </div>
      </div>

      <CreateListModal
        isOpen={isCreateListOpen}
        onClose={() => setIsCreateListOpen(false)}
        onListCreated={(slug) => {
          router.push(`/sheets/${slug}`);
        }}
      />
      <UserStatsDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        profile={profile}
      />
    </>
  );
}
