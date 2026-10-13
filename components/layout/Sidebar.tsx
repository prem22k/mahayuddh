"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Swords,
  Dumbbell,
  Users,
  Newspaper,
  MessagesSquare,
  Trophy,
  NotebookPen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { getAllLists } from "@/lib/data/sheets";
import { CustomList } from "@/types/database";
import { CreateListModal } from "@/components/modals/CreateListModal";
import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip } from "@/components/ui/Badge";

interface SidebarProps {
  onSearchOpen?: () => void;
}

const coreNav = [
  { name: "Arena", href: "/home", icon: Swords },
  { name: "Practice", href: "/practice", icon: Dumbbell },
  { name: "Squad", href: "/squad", icon: Users },
  { name: "Feed", href: "/feed", icon: Newspaper },
  { name: "Challenges", href: "/challenges", icon: MessagesSquare },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Notebook", href: "/notebook", icon: NotebookPen },
];

const pinnedSheets = ["NeetCode 150", "Blind 75", "Striver SDE"];

export function Sidebar({ onSearchOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const [lists, setLists] = useState<CustomList[]>([]);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  useEffect(() => {
    getAllLists()
      .then((data) => setLists(data))
      .catch(() => {});
  }, []);

  const displayName =
    profile?.username || user?.email?.split("@")[0] || "Squad Member";
  const displayHandle = (profile?.username || displayName)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const streak = profile?.streak || 23;

  return (
    <>
      <div className="flex h-full w-full select-none flex-col">
        <div className="px-4 pb-2 pt-5">
          <Link href="/home" className="sidebar-label font-display text-lg font-semibold tracking-tight text-text-primary">
            Mahayuddh
          </Link>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={onSearchOpen}
            className="flex h-9 w-full items-center justify-between rounded-md border border-hairline bg-well px-3 text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary"
          >
            <span className="sidebar-search-text flex items-center gap-2">
              <Search className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm">Search</span>
            </span>
            <kbd className="kbd">⌘K</kbd>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-2 pb-3">
          <nav className="sidebar-section space-y-0.5" aria-label="Primary">
            {coreNav.map((item) => {
              const aliases: Record<string, string[]> = {
                "/home": ["/"],
                "/challenges": ["/suggestions"],
                "/notebook": ["/vault"],
              };
              const isActive =
                pathname === item.href ||
                (aliases[item.href] || []).includes(pathname || "");
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn("nav-item", isActive && "active")}
                >
                  <Icon className="nav-icon h-5 w-5" strokeWidth={1.5} />
                  <span className="sidebar-label">{item.name}</span>
                  {item.name === "Challenges" && (
                    <span className="sidebar-label ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-surface-overlay text-[11px] text-text-primary">
                      1
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-sheets">
            <div className="sidebar-section px-3 pb-1 text-xs font-medium text-text-tertiary">
              Sheets
            </div>
            <nav className="space-y-0.5" aria-label="Sheets">
              {pinnedSheets.map((title) => {
                const match = lists.find((l) =>
                  l.title.toLowerCase().includes(title.split(" ")[0].toLowerCase())
                );
                const href = match ? `/sheets/${match.slug}` : "/sheets/neetcode-150";
                const isActive = pathname === href;
                return (
                  <Link
                    key={title}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn("nav-item", isActive && "active")}
                  >
                    <span className="sidebar-label truncate">{title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="border-t border-hairline p-3">
          <button
            onClick={() => setIsDossierOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-raised"
            title="Open your dossier"
          >
            <Avatar name={displayName} src={profile?.avatar_url} size="md" />
            <span className="sidebar-user-meta min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                {displayName}
              </span>
              <span className="block truncate font-mono text-xs text-text-tertiary">
                @{displayHandle} · Kshatriya
              </span>
              <span className="mt-1 block text-xs text-text-tertiary">
                Solve today to keep {streak}
              </span>
            </span>
            <StreakChip count={streak} alive={false} />
          </button>
          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            className="mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
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
