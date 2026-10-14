"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X, Check } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip, VerifiedBadge } from "@/components/ui/Badge";
import { copyText } from "@/lib/clipboard";
import { Profile } from "@/types/database";

interface UserStatsDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  statusMap?: Record<string, string>;
  userCalendarJson?: string | Record<string, number> | null;
}

/**
 * Warrior dossier (31): a five-second picture of someone's practice.
 *
 * No power level, tiers, achievements, radar, or rings — the landing page
 * promises "no XP, no badges" and this modal keeps that promise. Only
 * measured numbers appear; anything unknown is said to be unknown.
 */
export function UserStatsDossierModal({
  isOpen,
  onClose,
  profile,
  statusMap = {},
}: UserStatsDossierModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !profile) return null;

  const displayName = profile.username || "Squad Member";
  const easy = profile.total_easy || 0;
  const medium = profile.total_medium || 0;
  const hard = profile.total_hard || 0;
  const totalSolved = easy + medium + hard;
  const streak = profile.streak || 0;
  const rating = profile.contest_rating;
  const synced = profile.last_synced_at
    ? new Date(profile.last_synced_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;

  const recentSlugs = Object.entries(statusMap)
    .filter(([, v]) => v === "solved" || v === "verified")
    .slice(0, 3)
    .map(([slug]) => slug);

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/u/${encodeURIComponent(displayName)}`
        : `/u/${encodeURIComponent(displayName)}`;
    if (!(await copyText(url))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ModalShell label={`Practice summary for ${displayName}`} onClose={onClose} maxWidthClass="max-w-[560px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName} src={profile.avatar_url} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-semibold tracking-tight">
              {displayName}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-text-tertiary">@{displayName}</p>
            <div className="mt-1.5">
              <StreakChip count={streak} alive={streak > 0} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="primary"
            onClick={onClose}
            className="hidden min-h-[44px] sm:inline-flex"
          >
            <Link href={`/challenges?to=${profile.id}`}>Challenge {displayName}</Link>
          </Button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-3 sm:hidden">
        <Button variant="primary" className="w-full min-h-[44px]">
          <Link href={`/challenges?to=${profile.id}`}>Challenge {displayName}</Link>
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="font-display text-2xl font-semibold tnum">{totalSolved}</p>
          <p className="mt-0.5 text-xs leading-5 text-text-tertiary">Solved</p>
        </div>
        <div>
          <p className="font-display text-2xl font-semibold tnum">
            {easy + medium + hard > 0 ? `${easy} · ${medium} · ${hard}` : "—"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-text-tertiary">Easy · Medium · Hard</p>
        </div>
        <div>
          <p className="font-display text-2xl font-semibold tnum">
            {rating == null ? "—" : Math.round(rating).toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-text-tertiary">Contest rating</p>
        </div>
        <div>
          <p className="font-display text-2xl font-semibold tnum">
            {profile.contest_attended || "—"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-text-tertiary">Contests</p>
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-text-tertiary">
        {profile.leetcode_username
          ? `From LeetCode · ${synced ? `synced ${synced}` : "not synced yet"}`
          : "Contest rating not available · LeetCode not connected"}
      </p>

      <section className="mt-5 border-t border-hairline pt-4">
        <h3 className="text-sm font-medium text-text-secondary">Recent verified solves</h3>
        {recentSlugs.length > 0 ? (
          <ul className="mt-2 divide-y divide-hairline rounded-md border border-hairline">
            {recentSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/practice/${slug}`}
                  className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-raised"
                >
                  <span className="truncate text-sm capitalize text-text-primary">
                    {slug.replace(/-/g, " ")}
                  </span>
                  <VerifiedBadge />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            No recent verified solves to show here. The full history lives on their public
            page.
          </p>
        )}
      </section>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-hairline pt-4">
        <Link
          href={`/u/${encodeURIComponent(displayName)}`}
          className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        >
          View full profile
        </Link>
        <button
          onClick={handleShare}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        >
          {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : null}
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </ModalShell>
  );
}
