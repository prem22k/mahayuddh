"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { profileHref } from "@/lib/profiles/username";
import { cn } from "@/lib/utils";

/**
 * Per-member solves for a season, longest bar first (the order the result
 * already sorts in). The viewer's own row is pinned with a surface-overlay
 * fill and a "You" tag, the leaderboard convention — no gold, no medals.
 */
export function WhoPractised({ members }: { members: { username: string; solves: number }[] }) {
  const { profile } = useAuth();
  const me = profile?.username ?? null;
  const max = Math.max(1, ...members.map((m) => m.solves));
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
      {members.map((m, i) => {
        const you = me != null && m.username === me;
        const width = `${Math.round((m.solves / max) * 100)}%`;
        return (
          <li
            key={`${m.username}-${i}`}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors md:grid-cols-[12rem_minmax(0,1fr)_5rem] md:gap-x-6 md:py-4",
              you ? "bg-surface-overlay" : "hover:bg-surface-raised"
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
              <Avatar
                name={m.username}
                size="sm"
                className="border border-hairline font-mono md:h-8 md:w-8 md:text-xs"
              />
              <Link
                href={profileHref(m.username)}
                className="truncate text-sm font-medium text-text-primary hover:underline"
              >
                @{m.username}
              </Link>
              {you && (
                <span className="inline-flex h-5 shrink-0 items-center rounded-xs border border-hairline-strong px-1.5 font-mono text-[11px] font-medium leading-none text-text-secondary">
                  You
                </span>
              )}
            </div>
            <p className="text-right md:order-3">
              <span className="font-mono text-sm font-semibold text-text-primary tnum">{m.solves}</span>
              <span className="ml-1 text-xs text-text-secondary">{m.solves === 1 ? "solve" : "solves"}</span>
            </p>
            <span
              aria-hidden
              className="col-span-2 h-1.5 overflow-hidden rounded-full bg-well md:order-2 md:col-span-1 md:h-2"
            >
              <span
                className={cn("block h-full rounded-full", you ? "bg-text-primary" : "bg-text-secondary")}
                style={{ width }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
