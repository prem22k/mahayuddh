"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ExternalLink, RefreshCw, ArrowRight, Link2, Shield, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncErrorMessage } from "@/lib/syncError";
import { getSquadProfiles, syncUserProfileStats } from "@/lib/data/profiles";
import { calculatePowerLevel } from "@/lib/stats";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConnectLeetCodeModal } from "@/components/modals/ConnectLeetCodeModal";
import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";
import { Spinner } from "@/components/ui/Spinner";
import { PageLoader } from "@/components/ui/PageLoader";
import { Profile } from "@/types/database";

type MetricKey = "score" | "rating" | "contests" | "easy" | "medium" | "hard" | "total" | "streak";
type SortDir = "desc" | "asc";

const METRICS: { key: MetricKey; label: string; title: string }[] = [
  { key: "score", label: "Score", title: "Total approximation: rating×1.5 + hard×30 + medium×10 + easy×3, streak bonus up to 40%" },
  { key: "rating", label: "Rating", title: "LeetCode contest rating" },
  { key: "contests", label: "Contests", title: "Contests attended" },
  { key: "easy", label: "Easy", title: "Easy problems solved" },
  { key: "medium", label: "Med", title: "Medium problems solved" },
  { key: "hard", label: "Hard", title: "Hard problems solved" },
  { key: "total", label: "Total", title: "Total problems solved" },
  { key: "streak", label: "Streak", title: "Daily streak (days)" },
];

// Shared grid: rank | member | 8 metrics | action. Horizontal scroll below ~960px.
const GRID = "44px minmax(170px,1.5fr) repeat(8,minmax(62px,0.65fr)) minmax(140px,0.9fr)";

function getMetricValue(m: Profile, key: MetricKey): number {
  switch (key) {
    case "score":
      return calculatePowerLevel(m);
    case "rating":
      // Unrated members sort below every rated one.
      return m.contest_rating == null ? -1 : Math.round(m.contest_rating);
    case "contests":
      return m.contest_attended || 0;
    case "easy":
      return m.total_easy || 0;
    case "medium":
      return m.total_medium || 0;
    case "hard":
      return m.total_hard || 0;
    case "total":
      return (m.total_easy || 0) + (m.total_medium || 0) + (m.total_hard || 0);
    case "streak":
      return m.streak || 0;
  }
}

export default function LeaderboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<MetricKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [hideUnconnected, setHideUnconnected] = useState(false);
  const [inspectedProfile, setInspectedProfile] = useState<Profile | null>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Connect handle input state
  const [inputHandle, setInputHandle] = useState("");
  const [isConnectingHandle, setIsConnectingHandle] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const loadLeaderboardData = async () => {
    try {
      const data = await getSquadProfiles();
      setProfiles(data);
    } catch (err) {
      console.error("Error loading profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData();
  }, []);

  useEffect(() => {
    loadLeaderboardData();
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

  // Click cycles: new column → desc → asc → default (score desc)
  const handleSort = (key: MetricKey) => {
    if (key !== sortKey) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey("score");
      setSortDir("desc");
    }
  };

  const { visibleMembers, rankMap } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = profiles.filter((m) => {
      if (hideUnconnected && !m.leetcode_username) return false;
      if (!q) return true;
      return (
        m.username.toLowerCase().includes(q) ||
        (m.leetcode_username || "").toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      // Null-rating members always sink below rated ones, in EITHER direction —
      // getMetricValue's -1 sentinel alone would float them to the top on asc.
      if (sortKey === "rating") {
        const aNull = a.contest_rating == null;
        const bNull = b.contest_rating == null;
        if (aNull && !bNull) return 1;
        if (!aNull && bNull) return -1;
      }
      const diff = getMetricValue(a, sortKey) - getMetricValue(b, sortKey);
      if (diff !== 0) return sortDir === "desc" ? -diff : diff;
      // Stable tiebreaks: score, then rating (unrated last), then name
      return (
        calculatePowerLevel(b) - calculatePowerLevel(a) ||
        (b.contest_rating ?? -1) - (a.contest_rating ?? -1) ||
        a.username.localeCompare(b.username)
      );
    });

    // Dense ranks: ties on the active metric share a rank
    const ranks = new Map<string, number>();
    let rank = 0;
    let prevVal: number | null = null;
    for (const m of sorted) {
      const v = getMetricValue(m, sortKey);
      if (prevVal === null || v !== prevVal) {
        rank += 1;
        prevVal = v;
      }
      ranks.set(m.id, rank);
    }
    return { visibleMembers: sorted, rankMap: ranks };
  }, [profiles, query, hideUnconnected, sortKey, sortDir]);

  const myRank = user ? rankMap.get(user.id) ?? null : null;

  const totalMySolved =
    (profile?.total_easy || 0) + (profile?.total_medium || 0) + (profile?.total_hard || 0);
  const myScore = profile ? calculatePowerLevel(profile) : 0;

  // Inactive metric columns dim so the sorted column holds focus
  const metricCell = (active: boolean) =>
    cn("flex justify-center transition-opacity duration-200", !active && "opacity-40");

  const getRankIndicator = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="font-mono text-xs font-black text-[#ffd60a]">
          01
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="font-mono text-xs font-black text-white/80">
          02
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="font-mono text-xs font-black text-[#ff9f0a]">
          03
        </span>
      );
    }
    return (
      <span className="font-mono text-xs text-white/30 font-semibold">
        {rank < 10 ? `0${rank}` : rank}
      </span>
    );
  };

  return (
    <div className="space-y-8 select-none">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Standings & Metrics
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Leaderboard
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Live rankings synchronized with LeetCode submissions. Click a column to sort.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full">
            <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search squad..."
              className="bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none w-28 sm:w-36"
            />
          </div>
          <button
            onClick={() => setHideUnconnected((v) => !v)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer border",
              hideUnconnected
                ? "bg-white/[0.12] text-white border-white/[0.1]"
                : "text-white/40 hover:text-white/80 border-white/[0.06]"
            )}
            title="Hide members without a linked LeetCode handle"
          >
            Linked only
          </button>
        </div>
      </div>

      {/* ── Personal Standing & LeetCode Stats Ribbon ── */}
      {profile?.leetcode_username ? (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent border border-white/[0.08] backdrop-blur-xl shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fa586a] to-[#ff8a9c] flex items-center justify-center font-black text-white text-base shadow-glow shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.username.charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white">
                  {profile.username}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#fa586a]/15 text-[#fa586a] border border-[#fa586a]/30 text-[10px] font-bold uppercase tracking-wider">
                  You
                </span>
                {myRank && (
                  <span className="text-xs font-mono font-bold text-[#ffd60a]">
                    Rank #{myRank < 10 ? `0${myRank}` : myRank}
                  </span>
                )}
              </div>
              <a
                href={`https://leetcode.com/${profile.leetcode_username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 font-mono mt-0.5"
              >
                <span>@{profile.leetcode_username}</span>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">
                Score
              </span>
              <span className="text-lg font-black text-white font-mono leading-tight">
                {myScore.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">
                Rating
              </span>
              <span className="text-lg font-black text-white font-mono leading-tight">
                {profile.contest_rating == null ? "—" : Math.round(profile.contest_rating)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">
                Contests
              </span>
              <span className="text-lg font-black text-[#bf5af2] font-mono leading-tight">
                {profile.contest_attended || 0}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">
                Streak
              </span>
              <span className="text-lg font-black text-[#ff9f0a] font-mono leading-tight">
                {profile.streak || 0}d
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">
                Solved ({totalMySolved})
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold mt-0.5">
                <span className="text-[#30d158]">{profile.total_easy}E</span>
                <span className="text-white/20">•</span>
                <span className="text-[#ff9f0a]">{profile.total_medium}M</span>
                <span className="text-white/20">•</span>
                <span className="text-[#ff453a]">{profile.total_hard}H</span>
              </div>
            </div>

            {/* View Personal Dossier Button */}
            <button
              onClick={() => setInspectedProfile(profile)}
              className="px-4 py-2 rounded-full border border-[#fa586a]/40 bg-gradient-to-r from-[#fa586a]/20 to-[#bf5af2]/20 hover:from-[#fa586a]/30 hover:to-[#bf5af2]/30 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-glow"
              title="Open your unique Holographic Battle Dossier & Combat Radar"
            >
              <Shield className="w-3.5 h-3.5 text-[#fa586a]" />
              <span>Your Dossier</span>
            </button>

            {/* Full History Sync Button */}
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-3.5 py-2 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Import all historical solved problems with your LeetCode session"
            >
              <Link2 className="w-3.5 h-3.5 text-[#fa586a]" />
              <span>Full History</span>
            </button>

            {/* Sync Button */}
            <button
              onClick={handleSyncMyStats}
              disabled={isSyncing}
              className={cn(
                "px-4 py-2 rounded-full border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                syncSuccess
                  ? "bg-[#30d158]/15 border-[#30d158]/30 text-[#30d158]"
                  : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-white"
              )}
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-[#fa586a]")}
              />
              <span>{syncSuccess ? "Synced!" : isSyncing ? "Syncing..." : "Sync Stats"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Connect Handle Prompt */
        <div className="p-5 rounded-3xl bg-[#1c1c1e]/80 border border-white/[0.08] backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold text-[#fa586a] uppercase tracking-wider">
              LeetCode Integration
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              Connect your LeetCode handle to join the leaderboard
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Synchronize your contest rating, problem counts, and daily active streaks.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
            <form onSubmit={handleConnectHandle} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={inputHandle}
                onChange={(e) => setInputHandle(e.target.value)}
                placeholder="Your LeetCode username"
                className="px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono w-full md:w-56"
                required
              />
              <button
                type="submit"
                disabled={isConnectingHandle || !inputHandle.trim()}
                className="px-4 py-2 rounded-xl bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-bold text-xs transition-all disabled:opacity-40 shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                {isConnectingHandle ? (
                  <Spinner size="sm" tone="inverse" />
                ) : (
                  <>
                    <span>Connect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
              title="Connect with credentials to import complete solved history"
            >
              <Link2 className="w-3.5 h-3.5 text-[#fa586a]" />
              <span>Full History Import</span>
            </button>
          </div>
          {connectError && (
            <div className="text-xs text-[#ff453a] font-medium w-full">{connectError}</div>
          )}
        </div>
      )}

      {/* ── Leaderboard Table ── */}
      <div aria-live="polite" className="sr-only">
        Sorted by {METRICS.find((m) => m.key === sortKey)?.label} {sortDir === "desc" ? "descending" : "ascending"};{" "}
        {visibleMembers.length} squad member{visibleMembers.length === 1 ? "" : "s"} shown.
      </div>
      <div
        role="table"
        aria-label="Squad leaderboard"
        className="bg-[#1c1c1e]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-subtle backdrop-blur-xl"
      >
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div
              role="row"
              className="grid gap-2 px-6 py-3 border-b border-white/[0.06] text-[11px] font-semibold text-white/30 uppercase tracking-wider items-center"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="text-center">#</div>
              <div>Squad Member</div>
              {METRICS.map(({ key, label, title }) => {
                const active = sortKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSort(key)}
                    title={`${title}. Click to cycle desc → asc → default.`}
                    aria-label={`Sort by ${label}${active ? ` (currently ${sortDir === "desc" ? "descending" : "ascending"})` : ""}`}
                    className={cn(
                      "flex items-center justify-center gap-1 uppercase tracking-wider text-[11px] font-semibold transition-colors cursor-pointer",
                      active ? "text-white" : "hover:text-white/70"
                    )}
                  >
                    <span>{label}</span>
                    {active ? (
                      sortDir === "desc" ? (
                        <ArrowDown className="w-3 h-3 text-[#fa586a]" />
                      ) : (
                        <ArrowUp className="w-3 h-3 text-[#fa586a]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </button>
                );
              })}
              <div className="text-right">Action</div>
            </div>

            {loading ? (
              <PageLoader label="Loading leaderboard..." className="h-48" />
            ) : visibleMembers.length === 0 ? (
              <div className="p-12 text-center text-white/40 text-xs">
                {profiles.length === 0
                  ? "No profiles registered in this squad yet. When members log in or add their LeetCode handles, they will appear here."
                  : "No squad members match this filter."}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {visibleMembers.map((member) => {
                  const isCurrentUser = member.id === user?.id;
                  const rank = rankMap.get(member.id) ?? 0;
                  const contestRank = member.contest_global_rank ?? member.global_rank;

                  return (
                    <div
                      key={member.id}
                      role="row"
                      aria-label={`${member.username}, rank ${rank}`}
                      className={cn(
                        "grid gap-2 px-6 py-3.5 items-center hover:bg-white/[0.03] transition-colors group text-xs",
                        isCurrentUser && "bg-white/[0.04] border-l-2 border-l-[#fa586a]"
                      )}
                      style={{ gridTemplateColumns: GRID }}
                    >
                      <div className="flex justify-center">
                        {getRankIndicator(rank)}
                      </div>

                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-white text-[11px] shrink-0 group-hover:border-[#fa586a]/40 transition-colors overflow-hidden">
                          {member.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={member.avatar_url}
                              alt={member.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            member.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-white truncate group-hover:text-[#fa586a] transition-colors">
                              {member.username}
                            </span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#fa586a] text-white uppercase tracking-wider shrink-0">
                                YOU
                              </span>
                            )}
                          </div>
                          <a
                            href={`https://leetcode.com/${member.leetcode_username || ""}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 font-mono"
                          >
                            <span>@{member.leetcode_username || "no_handle"}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                          </a>
                        </div>
                      </div>

                      <div className={metricCell(sortKey === "score")}>
                        <span className="font-mono font-black text-white text-sm">
                          {calculatePowerLevel(member).toLocaleString()}
                        </span>
                      </div>

                      <div className={cn(metricCell(sortKey === "rating"), "flex-col !justify-center")}>
                        <span className="font-mono font-bold text-white text-sm">
                          {member.contest_rating == null ? "—" : Math.round(member.contest_rating)}
                        </span>
                        <span
                          className="text-[10px] text-white/40 font-mono"
                          title={member.contest_top_percentage ? `Top ${member.contest_top_percentage}% of contestants` : undefined}
                        >
                          {contestRank ? `Rank #${contestRank.toLocaleString()}` : "—"}
                        </span>
                      </div>

                      <div className={metricCell(sortKey === "contests")}>
                        <span className="font-mono font-bold text-[#bf5af2] text-sm">
                          {member.contest_attended || 0}
                        </span>
                      </div>

                      <div className={metricCell(sortKey === "easy")}>
                        <span className="px-1.5 py-0.5 rounded bg-[#30d158]/10 text-[#30d158] font-mono text-[11px] font-semibold">
                          {member.total_easy}
                        </span>
                      </div>

                      <div className={metricCell(sortKey === "medium")}>
                        <span className="px-1.5 py-0.5 rounded bg-[#ff9f0a]/10 text-[#ff9f0a] font-mono text-[11px] font-semibold">
                          {member.total_medium}
                        </span>
                      </div>

                      <div className={metricCell(sortKey === "hard")}>
                        <span className="px-1.5 py-0.5 rounded bg-[#ff453a]/10 text-[#ff453a] font-mono text-[11px] font-semibold">
                          {member.total_hard}
                        </span>
                      </div>

                      <div className={metricCell(sortKey === "total")}>
                        <span className="font-mono font-bold text-white text-sm">
                          {(member.total_easy || 0) + (member.total_medium || 0) + (member.total_hard || 0)}
                        </span>
                      </div>

                      <div className={metricCell(sortKey === "streak")}>
                        <div className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/80 font-mono text-[11px] font-semibold">
                          {member.streak}d
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectedProfile(member)}
                          className="px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#fa586a]/15 hover:border-[#fa586a]/30 border border-white/[0.08] text-white/70 hover:text-[#fa586a] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                          title="Inspect Battle Dossier"
                        >
                          <Shield className="w-3 h-3" />
                          <span className="hidden md:inline">Dossier</span>
                        </button>
                        {!isCurrentUser ? (
                          <a
                            href={`/suggestions?to=${member.id}`}
                            className="px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#fa586a] hover:text-white border border-white/[0.08] text-white/60 text-xs font-semibold transition-all shadow-sm"
                          >
                            Challenge
                          </a>
                        ) : (
                          <span className="text-[11px] text-white/30 font-medium italic pr-1 hidden lg:inline">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Stats Holographic Dossier Modal */}
      <UserStatsDossierModal
        isOpen={!!inspectedProfile}
        onClose={() => setInspectedProfile(null)}
        profile={inspectedProfile}
      />

      {/* Connect LeetCode Modal */}
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
