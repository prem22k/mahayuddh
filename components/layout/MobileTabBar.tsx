"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Code, Users, MessageSquareText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive } from "./Sidebar";

interface Tab {
  name: string;
  href: string;
  icon: LucideIcon;
  aliases: string[];
}

const TABS: Tab[] = [
  { name: "Arena", href: "/home", icon: Swords, aliases: ["/"] },
  { name: "Practice", href: "/practice", icon: Code, aliases: [] },
  { name: "Squad", href: "/squad", icon: Users, aliases: [] },
  { name: "Feed", href: "/feed", icon: MessageSquareText, aliases: [] },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (tab: Tab) => isNavActive(pathname, tab.href, tab.aliases);

  return (
    <nav className="mobile-tabbar" aria-label="Primary">
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
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
