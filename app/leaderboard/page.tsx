"use client";

import Link from "next/link";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock,
  ExternalLink,
  Flame,
  RefreshCw,
  ShieldCheck,
  Swords,
  TrendingUp,
  User,
} from "lucide-react";
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
import { getSquadName } from "@/lib/data/squadActivity";
import { cn } from "@/lib/utils";
import {
  boardActionCls,
  boardListCls,
  boardRankCls,
  boardRowCls,
} from "@/components/leaderboard/rowStyles";

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

/** Unit after the number: long on desktop, one word on phones. */
function metricUnit(key: MetricKey, period: PeriodKey): { long: string; short: string } {
  switch (key) {
    case "verified":
      return period === "week"
        ? { long: "verified this week", short: "solves" }
        : { long: "verified solves", short: "solves" };
    case "streak":
      return period === "week"
        ? { long: "solves this week", short: "solves" }
        : { long: "day streak", short: "days" };
    case "hard":
      return { long: "hard solved", short: "hard" };
    case "rating":
      return { long: "rating", short: "rating" };
  }
}

function deltaTone(label: string): string {
  if (label.startsWith("↑")) return "text-verified";
  if (label.startsWith("↓")) return "text-error";
  if (label === "New") return "text-text-secondary";
  return "text-text-disabled md:text-text-tertiary";
}

const LONG_BOARD = 8;

export default function LeaderboardPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
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

  // Waits for auth: loading before the profile arrives read "no squad" and
  // flipped every visit to the Global tab.
  useEffect(() => {
    if (authLoading) return;
    loadLeaderboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.active_squad_id]);

  const [squadName, setSquadName] = useState<string | null>(null);
  useEffect(() => {
    const id = profile?.active_squad_id;
    if (!id) {
      setSquadName(null);
      return;
    }
    let cancelled = false;
    getSquadName(id)
      .then((n) => !cancelled && setSquadName(n))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile?.active_squad_id]);

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

  const unit = metricUnit(metricKey, period);

  // Each metric's glyph shows on phones (Stitch mobile chips); on desktop only
  // the selected chip carries its glyph.
  const metricLeading: Record<string, React.ReactNode> = {
    "Verified solves": <span className="h-1.5 w-1.5 rounded-full bg-verified" />,
    Streak: <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />,
    "Hard solved": <span className="h-1.5 w-1.5 rounded-full bg-error" />,
    "Contest rating": <TrendingUp className="h-3.5 w-3.5 text-pattern" strokeWidth={1.5} />,
  };
  const leading = Object.fromEntries(
    METRICS.map((m) => [
      m,
      <span key={m} aria-hidden className={cn("inline-flex", m !== metric && "md:hidden")}>
        {metricLeading[m]}
      </span>,
    ])
  );

  const periodControl = (
    <SegmentedControl
      label="Time period"
      value={period}
      onChange={setPeriod}
      className="max-md:h-auto [&>button]:whitespace-nowrap"
      options={[
        { value: "week", label: "Last 7 days" },
        { value: "all", label: "All time" },
      ]}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-reading flex-col">
      <div className="flex items-center justify-between gap-4 pb-4 md:pb-6">
        <h1 className="type-display-md text-text-primary max-md:text-2xl max-md:leading-[29px] max-md:tracking-[-0.015em]">
          Leaderboard
        </h1>
        <SegmentedControl
          label="Squad or global standings"
          value={tab}
          onChange={setTab}
          className="max-md:h-auto [&>button]:whitespace-nowrap"
          options={[
            { value: "squad", label: "Squad", title: "Your active squad" },
            { value: "global", label: "Global", title: "Everyone" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3 border-b border-hairline pb-4 md:flex-row md:items-center md:justify-between md:pb-6">
        <FilterChips
          options={METRICS}
          value={metric}
          onChange={setMetric}
          leading={leading}
          scroll
          label="Rank by"
        />
        <div className="flex items-center justify-between gap-3 md:shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary md:hidden">
            <Clock className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Time window
          </span>
          {periodControl}
        </div>
      </div>

      {!profile?.leetcode_username && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:mt-6 md:flex-row md:items-center md:justify-between md:p-5">
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
              className="h-10 min-h-[44px] min-w-0 flex-1 rounded-md border border-hairline bg-well px-3.5 font-mono text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:min-h-0 md:w-52 md:flex-none"
              required
            />
            <Button type="submit" variant="secondary" loading={isConnectingHandle} disabled={!inputHandle.trim()}>
              Connect
            </Button>
          </form>
          {connectError && <p className="text-sm text-error">{connectError}</p>}
        </div>
      )}

      {loadError && (
        <div className="mt-4 md:mt-6">
          <ErrorCard message={loadError} onRetry={() => { setLoading(true); loadLeaderboardData(); }} />
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        Sorted by {metric}; {visibleMembers.length} squad member{visibleMembers.length === 1 ? "" : "s"} shown.
      </div>

      <div className="mt-4 md:mt-6">
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
            <ol className={boardListCls}>
              {visibleMembers.map((member) => {
                const isCurrentUser = member.id === user?.id;
                const rank = rankMap.get(member.id) ?? 0;
                const noValue = metricKey === "rating" && member.contest_rating == null;
                const delta = rankChangeLabel(prevRanks.get(member.id), rank, prevReadOk);
                return (
                  <li
                    key={member.id}
                    aria-label={`${member.username}, rank ${rank}`}
                    className={boardRowCls(isCurrentUser)}
                  >
                    <span className={cn(boardRankCls(rank), isCurrentUser && "max-md:font-semibold max-md:text-text-primary")}>
                      {rank}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectedProfile(member)}
                      aria-label={`Open ${member.username}'s dossier`}
                      className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left md:gap-4"
                    >
                      <Avatar
                        name={member.username}
                        src={member.avatar_url}
                        size="md"
                        className={isCurrentUser ? "ring-1 ring-primary/40" : undefined}
                      />
                      <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                          <span className={cn("truncate text-sm font-semibold text-text-primary", isCurrentUser && "shrink-0")}>
                            {member.username}
                            {isCurrentUser && <span className="hidden md:inline"> (you)</span>}
                          </span>
                          {isCurrentUser && (
                            <span className="shrink-0 rounded-xs border border-hairline bg-primary-tint px-1.5 text-[10px] font-medium uppercase leading-4 text-primary md:hidden">
                              You
                            </span>
                          )}
                          {isCurrentUser && squadName && (
                            <span className="hidden min-w-0 truncate rounded-xs border border-hairline bg-primary-tint px-1.5 py-0.5 font-mono text-xs font-medium tracking-[0.06em] text-primary/80 md:inline-block">
                              {squadName}
                            </span>
                          )}
                        </span>
                        {member.leetcode_username && (
                          <span
                            className={cn(
                              "truncate font-mono text-xs leading-4 text-text-tertiary",
                              isCurrentUser && "md:hidden"
                            )}
                          >
                            @{member.leetcode_username}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex shrink-0 flex-col items-end gap-0.5 md:flex-row md:items-center md:gap-4">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-sm font-medium text-text-primary tnum md:text-lg md:font-semibold">
                          {noValue ? "—" : valueOf(member)}
                        </span>
                        {!noValue && (
                          <>
                            <span className="font-mono text-sm text-text-primary md:hidden">{unit.short}</span>
                            <span className="hidden font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary md:inline">
                              {unit.long}
                            </span>
                          </>
                        )}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs font-medium leading-none tnum md:w-8 md:text-center md:text-sm",
                          deltaTone(delta)
                        )}
                        title={
                          prevDate
                            ? `Rank change since ${prevDate}`
                            : prevReadOk
                              ? "First snapshot: no prior rank yet"
                              : "No movement data yet"
                        }
                      >
                        {delta}
                      </span>
                    </div>

                    <div className="hidden shrink-0 items-center justify-end gap-1.5 md:flex md:w-[144px]">
                      <button
                        type="button"
                        onClick={() => setInspectedProfile(member)}
                        className={cn(
                          boardActionCls,
                          isCurrentUser
                            ? "px-3 text-text-primary"
                            : "md:opacity-0 md:focus-visible:opacity-100 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                        )}
                      >
                        Dossier
                      </button>
                      {!isCurrentUser && (
                        <Link href={`/challenges?to=${member.id}`} className={cn(boardActionCls, "px-3")}>
                          Challenge
                        </Link>
                      )}
                    </div>

                    {isCurrentUser ? (
                      <button
                        type="button"
                        onClick={() => setInspectedProfile(member)}
                        aria-label="Open your dossier"
                        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-primary hover:bg-well md:hidden"
                      >
                        <User className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    ) : (
                      <Link
                        href={`/challenges?to=${member.id}`}
                        aria-label={`Challenge ${member.username}`}
                        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-raised hover:text-text-primary md:hidden"
                      >
                        <Swords className="h-4 w-4" strokeWidth={1.5} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* The pinned row covers short boards; long ones keep a sticky "you" bar. */}
            {selfEntry && selfRank != null && visibleMembers.length > LONG_BOARD && (
              <div className="sticky bottom-4 mt-4 flex items-center gap-3 rounded-lg border border-hairline-strong bg-surface-overlay p-4">
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
          </div>
        )}
      </div>

      {/* LeetCode-linked controls: the filter and the sync actions travel together. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          aria-pressed={hideUnconnected}
          onClick={() => setHideUnconnected((v) => !v)}
          className="flex min-h-[44px] items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary aria-pressed:border-hairline-strong aria-pressed:bg-surface-overlay aria-pressed:text-text-primary md:h-9 md:min-h-0"
          title="Hide members without a linked LeetCode handle"
        >
          Linked only
        </button>
        {profile?.leetcode_username && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncMyStats}
              disabled={isSyncing}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-60 md:h-9 md:min-h-0"
            >
              <RefreshCw className={isSyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={1.5} />
              {syncSuccess ? "Synced" : isSyncing ? "Syncing…" : "Sync stats"}
            </button>
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className="flex min-h-[44px] items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-9 md:min-h-0"
            >
              Full history
            </button>
          </div>
        )}
        {profile?.leetcode_username && connectError && (
          <p role="alert" className="w-full text-xs text-error">
            {connectError}
          </p>
        )}
      </div>

      {tab === "squad" && (
        <div className="mt-6 flex items-start gap-2.5 rounded-md border border-hairline bg-well p-3 md:mt-8 md:justify-center md:border-0 md:bg-transparent md:p-0 md:text-center">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary md:hidden" strokeWidth={1.5} aria-hidden />
          <p className="text-xs font-medium leading-5 text-text-tertiary">
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
