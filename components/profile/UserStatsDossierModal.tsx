"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { X, Check, ChevronRight, ExternalLink, RefreshCw, Share2, Shield, SquareUser, Swords } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip } from "@/components/ui/Badge";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSquadName } from "@/lib/data/squadActivity";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
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
 * Stitch "Squad mate dossier": a 560px modal on desktop, a bottom sheet on
 * phones.
 *
 * No power level, tiers, achievements, radar, or rings — the landing page
 * promises "no XP, no badges" and this modal keeps that promise. Only
 * measured numbers appear; anything unknown is said to be unknown. The
 * frame's pattern calibration and timed recent solves have no per-member
 * source yet, so they are not drawn.
 */
export function UserStatsDossierModal({
  isOpen,
  onClose,
  profile,
  statusMap = {},
}: UserStatsDossierModalProps) {
  const { user, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [squadName, setSquadName] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  const squadId = isOpen ? profile?.active_squad_id ?? null : null;
  useEffect(() => {
    setSquadName(null);
    if (!squadId) return;
    let cancelled = false;
    // Squad names are public-read. A failed read just leaves the name out.
    getSquadName(squadId)
      .then((name) => {
        if (!cancelled) setSquadName(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [squadId]);

  if (!isOpen || !profile) return null;

  const isSelf = !!user && user.id === profile.id;
  const displayName = profile.username || "Squad Member";
  const linked = !!profile.leetcode_username;
  const easy = profile.total_easy || 0;
  const medium = profile.total_medium || 0;
  const hard = profile.total_hard || 0;
  const totalSolved = easy + medium + hard;
  const streak = profile.streak || 0;
  const rating = profile.contest_rating;
  const topPct = profile.contest_top_percentage;
  const contests = profile.contest_attended || 0;
  const synced = profile.last_synced_at
    ? new Date(profile.last_synced_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;
  const publicPath = `/u/${encodeURIComponent(displayName)}`;

  // Verified and self-reported stay distinct: only a "verified" status gets
  // the emerald glyph.
  const recent = Object.entries(statusMap)
    .filter(([, v]) => v === "solved" || v === "verified")
    .slice(0, 3)
    .map(([slug, v]) => ({ slug, verified: v === "verified" }));

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${publicPath}`
        : publicPath;
    if (!(await copyText(url))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSync = async () => {
    if (!isSelf || !profile.leetcode_username) return;
    setSyncing(true);
    setSyncFailed(false);
    try {
      const ok = await syncUserProfileStats(profile.id, profile.leetcode_username);
      await refreshProfile();
      setSyncFailed(!ok);
    } catch {
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  };

  const primaryCls =
    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors md:h-10";

  const primaryAction = isSelf ? (
    <Link
      href={publicPath}
      onClick={onClose}
      className={cn(primaryCls, "border border-hairline bg-surface-overlay text-text-primary hover:bg-[#272830]")}
    >
      <span>
        <span className="md:hidden">View public page</span>
        <span className="hidden md:inline">Public page</span>
      </span>
      <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
    </Link>
  ) : (
    <Link
      href={`/challenges?to=${profile.id}`}
      onClick={onClose}
      className={cn(primaryCls, "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed")}
    >
      <Swords className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      {/* Desktop keeps the button short so the name never truncates; the
          accessible name always includes who. */}
      <span className="truncate">
        Challenge<span className="md:sr-only"> {displayName}</span>
      </span>
    </Link>
  );

  const sectionLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary";

  return (
    <ModalShell
      label={`Practice summary for ${displayName}`}
      onClose={onClose}
      variant="sheet"
      zIndexClass="z-[300]"
      maxWidthClass="max-w-[560px]"
      panelClassName="max-h-[92vh] overflow-y-auto rounded-lg p-5 max-md:rounded-t-xl max-md:pt-8 md:p-7"
    >
      <div className="space-y-5 md:space-y-6">
        {/* Identity and the one action. */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 md:gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <Avatar name={displayName} src={profile.avatar_url} size="lg" className="border border-hairline-strong" />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="min-w-0 font-display text-xl font-semibold leading-tight tracking-tight text-text-primary [overflow-wrap:anywhere] md:text-[22px]">
                    {displayName}
                    {isSelf && (
                      <span className="whitespace-nowrap text-base font-normal tracking-normal text-text-tertiary"> (you)</span>
                    )}
                  </h2>
                  <StreakChip count={streak} alive={streak > 0} />
                </div>
                <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-text-secondary">
                  <span className="font-mono text-xs md:text-sm">@{displayName}</span>
                  {squadName && (
                    <>
                      <span aria-hidden className="text-text-tertiary">·</span>
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Shield className="h-3.5 w-3.5 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                        <span className="truncate">{squadName}</span>
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden md:block">{primaryAction}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title="Close (Esc)"
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-hairline text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary md:h-10 md:w-10 md:rounded-md md:border-0"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <div className="md:hidden [&>a]:w-full">{primaryAction}</div>
        </div>

        {/* Practice summary: plain measured figures. */}
        <div className="space-y-3 rounded-lg border border-hairline bg-well p-4">
          <div className="grid grid-cols-2 divide-x divide-hairline">
            <div className="min-w-0 space-y-1 pr-3 md:pr-4">
              <p className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tnum md:text-3xl",
                    linked ? "text-text-primary" : "text-text-tertiary"
                  )}
                >
                  {linked ? totalSolved.toLocaleString() : "—"}
                </span>
                <span className="text-xs font-medium text-text-secondary">solved</span>
              </p>
              <p className="font-mono text-xs leading-5 text-text-tertiary tnum">
                {linked ? (
                  <>
                    <span className="text-text-secondary">{easy}</span> Easy{" "}
                    <span aria-hidden className="text-hairline-strong">·</span>{" "}
                    <span className="text-text-secondary">{medium}</span> Med{" "}
                    <span aria-hidden className="text-hairline-strong">·</span>{" "}
                    <span className="text-text-secondary">{hard}</span> Hard
                  </>
                ) : (
                  "Not available"
                )}
              </p>
            </div>
            <div className="min-w-0 space-y-1 pl-3 md:pl-4">
              <p className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tnum md:text-3xl",
                    rating == null ? "text-text-tertiary" : "text-text-primary"
                  )}
                >
                  {rating == null ? "—" : Math.round(rating).toLocaleString()}
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  <span className="md:hidden">rating</span>
                  <span className="hidden md:inline">contest rating</span>
                </span>
              </p>
              <p className="font-mono text-xs leading-5 text-text-tertiary tnum">
                {rating == null ? (
                  "Not available"
                ) : (
                  <>
                    {topPct != null && (
                      <>
                        Top <span className="font-medium text-text-secondary">{topPct}%</span>{" "}
                        <span aria-hidden className="text-hairline-strong">·</span>{" "}
                      </>
                    )}
                    {contests} {contests === 1 ? "contest" : "contests"}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
            <p className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] leading-4 text-text-tertiary">
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", linked ? "bg-text-secondary" : "border border-hairline-strong")}
              />
              <span className="truncate">
                {linked
                  ? `From LeetCode · ${synced ? `synced ${synced}` : "not synced yet"}`
                  : "LeetCode not connected"}
              </span>
            </p>
            {isSelf && linked && (
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:underline disabled:cursor-wait md:min-h-0"
              >
                <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} strokeWidth={1.5} aria-hidden />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
          </div>
          {syncFailed && (
            <p role="alert" className="text-[11px] leading-4 text-error">
              LeetCode didn&apos;t respond. Try again in a minute.
            </p>
          )}
        </div>

        {/* Recent solves: only what the caller passed in. */}
        <section aria-labelledby="dossier-recent-h" className="space-y-2">
          <h3 id="dossier-recent-h" className={sectionLabel}>
            Recent solves
          </h3>
          {recent.length > 0 ? (
            <ul className="space-y-1.5">
              {recent.map(({ slug, verified }) => (
                <li key={slug}>
                  <Link
                    href={`/practice/${slug}`}
                    onClick={onClose}
                    className="group flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-3 py-2.5 transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <StatusGlyph status={verified ? "verified" : "self-reported"} />
                      <span className="truncate text-sm font-medium capitalize text-text-primary">
                        {slug.replace(/-/g, " ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-text-tertiary">
                      {verified ? "Verified" : "Self-reported"}
                      <ChevronRight
                        className="h-3.5 w-3.5 transition-colors group-hover:text-text-primary"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-hairline bg-surface px-3 py-3 text-sm leading-6 text-text-secondary">
              No recent solves to show here. The full history lives on{" "}
              {isSelf ? "your" : "their"} public page.
            </p>
          )}
        </section>

        {/* Footer. */}
        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-4 md:pt-5">
          <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start md:gap-1">
            <Link
              href={publicPath}
              onClick={onClose}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:h-9 md:border-0"
            >
              <SquareUser className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              View full profile
            </Link>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:h-9 md:border-0"
            >
              {copied ? (
                <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              ) : (
                <Share2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              )}
              {copied ? "Copied" : "Share"}
            </button>
          </div>
          <span className="hidden font-mono text-[11px] tracking-[0.06em] text-text-tertiary md:inline">
            ESC to dismiss
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
