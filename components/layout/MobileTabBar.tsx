"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Trophy, Compass, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile tab bar (design.md §4).
 *
 * On a phone the slide-out drawer was the only navigation, which put every
 * destination two taps away behind a hamburger and left the whole bottom edge
 * to the solving dock. design.md §4 commits to a fixed four-tab bar with
 * >= 44x44 touch targets; this is that bar. It owns the bottom edge and the
 * dock sits directly above it (see --dock-bottom in globals.css).
 *
 * Four destinations, chosen by intent rather than by which table backs them:
 * the daily loop (Arena), the social comparison (Ranks), the catalogue
 * (Topics), and the inbox (Inbox). Profile, Squad, Feed, Notebook and Practice
 * stay in the drawer — a fifth and sixth tab would push the row under 44px.
 */
interface Tab {
  name: string;
  href: string;
  icon: LucideIcon;
  aliases: string[];
}

const TABS: Tab[] = [
  { name: "Arena", href: "/home", icon: LayoutGrid, aliases: ["/"] },
  { name: "Ranks", href: "/leaderboard", icon: Trophy, aliases: [] },
  { name: "Topics", href: "/patterns", icon: Compass, aliases: ["/sheets"] },
  { name: "Inbox", href: "/challenges", icon: MessageSquare, aliases: ["/suggestions"] },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (tab: Tab) =>
    pathname === tab.href || tab.aliases.includes(pathname || "");

  return (
    <nav className="mobile-tab-bar" aria-label="Primary">
      {TABS.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn("mobile-tab", active && "active")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="mobile-tab-icon w-[18px] h-[18px]" aria-hidden="true" />
            <span className="mobile-tab-label">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}