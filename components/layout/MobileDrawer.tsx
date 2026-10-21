"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  Trophy,
  ChartColumn,
  BookOpen,
  Compass,
  LifeBuoy,
  Shield,
  ChevronDown,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { useShellCounts } from "./useShellCounts";
import { isNavActive } from "./Sidebar";

/**
 * Mobile S2 drawer. The four primary sections live in the bottom tab bar, so
 * the drawer carries everything else: who you are, your squad, the secondary
 * sections, sheets, settings and sign out.
 */
export function MobileDrawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { profile, user, signOut } = useAuth();
  const { incomingChallenges, squadName, squadMemberCount, sheets } = useShellCounts();
  const [sheetsOpen, setSheetsOpen] = useState(true);

  const displayName = profile?.username || user?.email?.split("@")[0] || "Squad Member";

  const items = [
    { name: "Challenges", href: "/challenges", icon: Trophy, count: incomingChallenges },
    { name: "Leaderboard", href: "/leaderboard", icon: ChartColumn },
    { name: "Notebook", href: "/notebook", icon: BookOpen },
    { name: "Primers", href: "/primers", icon: Compass },
    { name: "Stuck requests", href: "/stuck", icon: LifeBuoy },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-4 pt-5">
        <Link href="/home" className="flex items-center gap-2.5" onClick={onClose}>
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <span className="font-display text-lg font-semibold tracking-tight text-text-primary">
            Mahayuddh
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="border-b border-hairline px-4 pb-4">
        <Link href="/profile" onClick={onClose} className="mb-3 flex items-center gap-3">
          <Avatar name={displayName} src={profile?.avatar_url} size="lg" className="border border-hairline" />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-text-primary">{displayName}</span>
            <span className="block truncate font-mono text-xs text-text-tertiary">
              @{profile?.username ?? displayName}
            </span>
          </span>
        </Link>
        {squadName && (
          <Link
            href="/squad"
            onClick={onClose}
            className="flex min-h-[44px] items-center justify-between gap-2 rounded-md border border-hairline px-3 text-sm transition-colors hover:border-hairline-strong"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
              <span className="truncate font-medium text-text-primary">{squadName}</span>
              {squadMemberCount !== null && (
                <span className="shrink-0 text-text-tertiary">
                  · {squadMemberCount} {squadMemberCount === 1 ? "member" : "members"}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-text-tertiary" strokeWidth={1.5} />
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <nav className="flex flex-col gap-0.5" aria-label="More">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[48px] items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-surface-raised text-text-primary"
                    : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                )}
              >
                <Icon
                  className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-text-tertiary")}
                  strokeWidth={1.5}
                />
                <span className="flex-1">{item.name}</span>
                {item.count ? (
                  <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full border border-primary/30 bg-primary-tint px-1.5 font-mono text-xs font-medium text-primary tnum">
                    {item.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSheetsOpen((v) => !v)}
            aria-expanded={sheetsOpen}
            className="flex min-h-[44px] w-full items-center justify-between px-3 font-mono text-xs font-medium uppercase tracking-[0.1em] text-text-tertiary"
          >
            Sheets
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", !sheetsOpen && "-rotate-90")}
              strokeWidth={1.5}
            />
          </button>
          {sheetsOpen && (
            <nav className="flex flex-col" aria-label="Sheets">
              {sheets.map((s) => {
                const pct =
                  s.progress && s.progress.total > 0
                    ? Math.round((s.progress.solved / s.progress.total) * 100)
                    : null;
                return (
                  <Link
                    key={s.slug}
                    href={`/sheets/${s.slug}`}
                    onClick={onClose}
                    className="flex min-h-[44px] items-center justify-between rounded-md pl-6 pr-3 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
                  >
                    <span className="truncate">{s.title}</span>
                    {pct !== null && (
                      <span className="font-mono text-xs text-text-tertiary tnum">{pct}%</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <div className="border-t border-hairline px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <Link
          href="/profile"
          onClick={onClose}
          className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[15px] font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <Settings className="h-[18px] w-[18px] text-text-tertiary" strokeWidth={1.5} />
          Settings
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-[15px] font-medium text-error transition-colors hover:bg-error-tint"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </div>
  );
}
