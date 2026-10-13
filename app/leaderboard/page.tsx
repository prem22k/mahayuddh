"use client";

import Link from "next/link";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ExternalLink, RefreshCw, ArrowRight } from "lucide-react";
import { GlobalLeaderboard } from "@/components/leaderboard/GlobalLeaderboard";
import { syncErrorMessage } from "@/lib/syncError";
import { getSquadProfiles, syncUserProfileStats } from "@/lib/data/profiles";
import {
  getPreviousSnapshotRanks,
  getSolvesWindow,
  getVerifiedSolvesWindow,
  rankChangeLabel,
  snapshotRanks,
  type SnapshotRow,
} from "@/lib/data/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConnectLeetCodeModal } from "@/components/modals/ConnectLeetCodeModal";
import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";
import { PageLoader } from "@/components/ui/PageLoader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FilterChips } from "@/components/ui/ProblemRow";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Profile } from "@/types/database";

type MetricKey = "verified" | "streak" | "hard" | "rating";
type PeriodKey = "week" | "all";

const METRICS: readonly string[] = ["Verified solves", "Streak", "Hard solved", "Contest rating"] as const;
const METRIC_TO_KEY: Record<string, MetricKey> = {
  "Verified solves": "verified",
  Streak: "streak",
  "Hard solved": "hard",
  "Contest rating": "rating",
};

function getMetricValue(m: Profile, key: MetricKey): number {
  switch (key) {
    case "verified":
      return (m.total_easy || 0) + (m.total_medium || 0) + (m.total_hard || 0);
    case "streak":
      return m.streak || 0;
    case "hard":
      return m.total_hard || 0;
    case "rating":
      return m.contest_rating == null ? -1 : Math.round(m.contest_rating);
  }
}

/** Lifetime totals above are the "All time" scope; the week scope resolves below. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function metricLabel(m: Profile, key: MetricKey, value: number, period: PeriodKey): string {
  if (period === "week") {
    if (key === "verified") return `${value} verified this week`;
    if (key === "streak") return `${value} solves this week`;
  }
  switch (key) {
    case "verified":
      return `${value} verified solves`;
    case "streak":
      return `${value} day streak`;
    case "hard":
      return `${value} hard solved`;
    case "rating":
      return m.contest_rating == null ? "Not linked" : `${Math.round(m.contest_rating)} rating`;
  }
}

export default function LeaderboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"squad" | "global">("squad");
  const [squadIds, setSquadIds] = useState<Set<string>>(new Set());
  const [metric, setMetric] = useState<string>("Verified solves");
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [hideUnconnected, setHideUnconnected] = useState(false);
  const [inspectedProfile, setInspectedProfile] = useState<Profile | null>(null);

  // Week-scope windows: measured event counts, not lifetime totals.
  const [windowVerified, setWindowVerified] = useState<Map<string, number>>(new Map());
  const [windowActivity, setWindowActivity] = useState<Map<string, number>>(new Map());

  // Rank movement: latest frozen snapshot before today for this view.
  const [prevRanks, setPrevRanks] = useState<Map<string, number>>(new Map());
  const [prevReadOk, setPrevReadOk] = useState(false);
  const [prevDate, setPrevDate] = useState<string | null>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Connect handle input state
  const [inputHandle, setInputHandle] = useState("");
  const [isConnectingHandle, setIsConnectingHandle] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const loadLeaderboardData = async () => {
    setLoadError(null);
    try {
      const data = await getSquadProfiles();
      setProfiles(data);
      if (profile?.active_squad_id) {
        const supabase = createClient();
        const { data: mems } = await supabase
          .from("squad_members")
          .select("user_id")
          .eq("squad_id", profile.active_squad_id);
        setSquadIds(new Set((mems ?? []).map((m) => (m as { user_id: string }).user_id)));
      } else {
        setSquadIds(new Set());
        setTab("global");
      }
    } catch (err) {
      console.error("Error loading profiles:", err);
      setLoadError("Couldn't load leaderboard. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncMyStats = async () => {
    if (!user || !profile?.leetcode_username) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    setConnectError(null);

    try {
      const synced = await syncUserProfileStats(user.id, profile.leetcode_username);
      if (!synced) {
        setConnectError("Could not sync LeetCode stats. Check the handle and try again.");
        return;
      }
      await refreshProfile();
      await loadLeaderboardData();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to sync:", e);
      const msg = e instanceof Response ? await syncErrorMessage(e, "Could not sync LeetCode stats. Please try again.") : "Could not sync LeetCode stats. Please try again.";
      setConnectError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputHandle.trim()) return;
    setIsConnectingHandle(true);
    setConnectError(null);

    try {
      const updated = await syncUserProfileStats(user.id, inputHandle.trim());
      if (updated) {
        await refreshProfile();
        await loadLeaderboardData();
        setInputHandle("");
      } else {
        setConnectError("Could not find LeetCode account. Check username spelling.");
      }
    } catch (e) {
      console.error("Failed to connect handle:", e);
      const msg =
        e instanceof Response
          ? await syncErrorMessage(e, "Sync failed. Please try again.")
          : "Sync failed. Please try again.";
      setConnectError(msg);
    } finally {
      setIsConnectingHandle(false);
    }
  };

  const metricKey = METRIC_TO_KEY[metric] ?? "verified";

  // Snapshot identity: squad views are per-squad (ranks would collide across
  // squads under a bare "squad"), and week/all-time are separate histories.
  const scopeKey = tab === "squad" && profile?.active_squad_id ? `squad:${profile.active_squad_id}` : tab;
  const snapshotMetric = `${metricKey}:${period}`;

  // Resolved board value: week scope ranks measured windows for the two
  // count metrics; hard and rating are lifetime by nature (difficulty and
  // point-in-time rating have no 7-day event source).
  const valueOf = useCallback(
    (m: Profile): number => {
      if (period === "week") {
        if (metricKey === "verified") return windowVerified.get(m.id) ?? 0;
        if (metricKey === "streak") return windowActivity.get(m.id) ?? 0;
      }
      return getMetricValue(m, metricKey);
    },
    [metricKey, period, windowVerified, windowActivity]
  );

  // Week windows load whenever the board's people or scope change. A failed
  // load keeps zeros rather than lifetime totals posing as weekly counts.
  useEffect(() => {
    if (period !== "week" || profiles.length === 0) return;
    let cancelled = false;
    const sinceISO = new Date(Date.now() - WEEK_MS).toISOString();
    const ids = profiles.map((p) => p.id);
    Promise.all([getVerifiedSolvesWindow(ids, sinceISO), getSolvesWindow(ids, sinceISO)])
      .then(([verified, activity]) => {
        if (cancelled) return;
        setWindowVerified(verified);
        setWindowActivity(activity);
      })
      .catch(() => {
        if (cancelled) return;
        setWindowVerified(new Map());
        setWindowActivity(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [period, profiles]);

  const visibleMembers = useMemo(() => {
    const scoped = tab === "squad" && squadIds.size > 0 ? profiles.filter((m) => squadIds.has(m.id)) : profiles;
    const filtered = scoped.filter((m) => {
      if (hideUnconnected && !m.leetcode_username) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (metricKey === "rating") {
        const aNull = a.contest_rating == null;
        const bNull = b.contest_rating == null;
        if (aNull && !bNull) return 1;
        if (!aNull && bNull) return -1;
      }
      const diff = valueOf(a) - valueOf(b);
      if (diff !== 0) return -diff;
      return a.username.localeCompare(b.username);
    });
    return sorted;
  }, [profiles, squadIds, tab, hideUnconnected, metricKey, valueOf]);

  const rankMap = useMemo(() => {
    const ranks = new Map<string, number>();
    let rank = 0;
    let prevVal: number | null = null;
    for (const m of visibleMembers) {
      const v = valueOf(m);
      if (prevVal === null || v !== prevVal) {
        rank += 1;
        prevVal = v;
      }
      ranks.set(m.id, rank);
    }
    return ranks;
  }, [visibleMembers, valueOf]);

  const memberIdsKey = useMemo(
    () => visibleMembers.map((m) => m.id).sort().join(","),
    [visibleMembers]
  );

  // Previous frozen ranks for the movement column. Runs on the squad board
  // only; the global tab renders its own segment board.
  useEffect(() => {
    if (tab !== "squad" || visibleMembers.length === 0) return;
    let cancelled = false;
    const ids = memberIdsKey.split(",").filter(Boolean);
    getPreviousSnapshotRanks(scopeKey, snapshotMetric, ids)
      .then((prev) => {
        if (cancelled) return;
        setPrevRanks(prev.ranks);
        setPrevReadOk(true);
        setPrevDate(prev.snapshotDate);
      })
      .catch(() => {
        if (cancelled) return;
        setPrevRanks(new Map());
        setPrevReadOk(false);
        setPrevDate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, scopeKey, snapshotMetric, memberIdsKey, visibleMembers.length]);

  // Freeze today's ranks once per view-day, fire-and-forget. A failed write
  // leaves the movement column honestly at "—".
  const rankedKey = useMemo(() => {
    const parts: string[] = [];
    for (const m of visibleMembers) {
      parts.push(`${m.id}:${rankMap.get(m.id) ?? 0}:${valueOf(m)}`);
    }
    return parts.join(",");
  }, [visibleMembers, rankMap, valueOf]);

  useEffect(() => {
    if (tab !== "squad" || visibleMembers.length === 0 || loading) return;
    const rows: SnapshotRow[] = visibleMembers.map((m) => ({
      user_id: m.id,
      rank: rankMap.get(m.id) ?? 0,
      value: valueOf(m),
    }));
    if (rows.some((r) => r.rank < 1)) return;
    void snapshotRanks(scopeKey, snapshotMetric, rows);
  }, [tab, scopeKey, snapshotMetric, rankedKey, loading, visibleMembers, rankMap, valueOf]);

  const selfEntry = user ? visibleMembers.find((m) => m.id === user.id) ?? null : null;
  const selfRank = user ? rankMap.get(user.id) ?? null : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="type-display-md text-text-primary">Leaderboard</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Where you stand among your squad.
          </p>
        </div>
        <SegmentedControl
          label="Squad or global standings"
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "squad", label: "Squad", title: "Your active squad" },
            { value: "global", label: "Global", title: "Everyone" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3">
        <FilterChips options={METRICS} value={metric} onChange={setMetric} />
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Time period"
            value={period}
            onChange={setPeriod}
            size="sm"
            options={[
              { value: "week", label: "Last 7 days" },
              { value: "all", label: "All time" },
            ]}
          />
          <button
            aria-pressed={hideUnconnected}
            onClick={() => setHideUnconnected((v) => !v)}
            className="flex min-h-[44px] items-center rounded-full border border-hairline px-3.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary aria-pressed:bg-surface-overlay aria-pressed:text-text-primary md:min-h-0 md:h-9"
            title="Hide members without a linked LeetCode handle"
          >
            Linked only
          </button>
        </div>
      </div>

      {profile?.leetcode_username ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleSyncMyStats} disabled={isSyncing}>
            <RefreshCw className={isSyncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} strokeWidth={1.5} />
            {syncSuccess ? "Synced" : isSyncing ? "Syncing…" : "Sync stats"}
          </Button>
          <Button variant="ghost" onClick={() => setIsConnectModalOpen(true)}>
            Full history
          </Button>
        </div>
      ) : (
        <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              Connect LeetCode to appear here
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Optional. Adds contest rating and verified solves, you are already on the board without it.
            </p>
          </div>
          <form onSubmit={handleConnectHandle} className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Your LeetCode username"
              value={inputHandle}
              onChange={(e) => setInputHandle(e.target.value)}
              placeholder="Your LeetCode username"
              className="h-10 min-h-[44px] rounded-md border border-hairline bg-well px-3.5 font-mono text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:min-h-0"
              required
            />
            <Button type="submit" variant="secondary" loading={isConnectingHandle} disabled={!inputHandle.trim()}>
              Connect
            </Button>
          </form>
          {connectError && <p className="text-sm text-error">{connectError}</p>}
        </div>
      )}

      {loadError && <ErrorCard message={loadError} onRetry={() => { setLoading(true); loadLeaderboardData(); }} />}

      <div aria-live="polite" className="sr-only">
        Sorted by {metric}; {visibleMembers.length} squad member{visibleMembers.length === 1 ? "" : "s"} shown.
      </div>

      {loading ? (
        <PageLoader label="Loading leaderboard..." className="h-48" />
      ) : visibleMembers.length === 0 ? (
        tab === "global" ? (
          <GlobalLeaderboard />
        ) : (
          <EmptyState
            heading="No squad members here yet"
            body="Join or create a squad, this tab ranks people you practice with."
            action={
              <Link
                href="/squad"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
              >
                Go to squad
              </Link>
            }
          />
        )
      ) : tab === "global" ? (
        <GlobalLeaderboard />
      ) : (
        <div className="relative">
          <ol className="mx-auto w-full max-w-reading divide-y divide-hairline rounded-xl border border-hairline bg-surface">
            {visibleMembers.map((member) => {
              const isCurrentUser = member.id === user?.id;
              const rank = rankMap.get(member.id) ?? 0;
              return (
                <li
                  key={member.id}
                  aria-label={`${member.username}, rank ${rank}`}
                  className={`group flex min-h-[56px] items-center gap-3 px-4 transition-colors hover:bg-surface-raised ${
                    isCurrentUser ? "bg-surface-overlay" : ""
                  }`}
                >
                  <span
                    className={`w-8 shrink-0 font-display text-[28px] font-semibold leading-[31px] tnum ${
                      rank <= 3 ? "text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    {rank}
                  </span>
                  <Avatar name={member.username} src={member.avatar_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-5 text-text-primary">
                      {member.username}
                      {isCurrentUser && (
                        <span className="ml-1.5 text-xs text-text-secondary">(you)</span>
                      )}
                    </p>
                    <p className="truncate font-mono text-xs text-text-tertiary tnum">
                      @{member.leetcode_username || "no_handle"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm text-text-primary tnum">
                      {metricKey === "rating" && member.contest_rating == null
                        ? "—"
                        : valueOf(member)}
                    </p>
                    <p
                      className="font-mono text-xs text-text-tertiary tnum"
                      title={
                        prevDate
                          ? `Rank change since ${prevDate}`
                          : prevReadOk
                            ? "First snapshot: no prior rank yet"
                            : "No movement data yet"
                      }
                    >
                      {rankChangeLabel(prevRanks.get(member.id), rank, prevReadOk)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1 md:flex md:opacity-0 md:group-hover:opacity-100">
                    <button
                      onClick={() => setInspectedProfile(member)}
                      className="flex h-10 items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                    >
                      Dossier
                    </button>
                    {!isCurrentUser && (
                      <Link
                        href={`/challenges?to=${member.id}`}
                        className="flex h-10 items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                      >
                        Challenge
                      </Link>
                    )}
                  </div>
                  {!isCurrentUser && (
                    <Link
                      href={`/challenges?to=${member.id}`}
                      aria-label={`Challenge ${member.username}`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text-primary md:hidden"
                    >
                      <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>

          {selfEntry && selfRank != null && (
            <div className="sticky bottom-4 mt-4 flex items-center gap-3 rounded-xl border border-hairline-strong bg-surface-overlay p-4">
              <Avatar name={selfEntry.username} src={selfEntry.avatar_url} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  You · #{selfRank}
                </p>
                <p className="truncate font-mono text-xs text-text-secondary tnum">
                  {selfEntry ? metricLabel(selfEntry, metricKey, valueOf(selfEntry), period) : ""}
                </p>
              </div>
              {profile?.leetcode_username && (
                <a
                  href={`https://leetcode.com/${profile.leetcode_username}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
                >
                  <span className="hidden sm:inline">LeetCode</span>
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-text-tertiary">
            Verified solves come from LeetCode sync. Last 7 days counts solves logged in the window; hard solved and contest rating are lifetime totals.
          </p>
        </div>
      )}

      <UserStatsDossierModal
        isOpen={!!inspectedProfile}
        onClose={() => setInspectedProfile(null)}
        profile={inspectedProfile}
      />

      <ConnectLeetCodeModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={async () => {
          await refreshProfile();
          await loadLeaderboardData();
        }}
      />
    </div>
  );
}
