"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, RefreshCw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSquadProfiles, syncUserProfileStats } from "@/lib/data/profiles";
import { useAuth } from "@/components/providers/AuthProvider";
import { Profile } from "@/types/database";

type LeaderboardTab = "rating" | "streak" | "hard" | "easy";

export default function LeaderboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("rating");

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Connect handle input state
  const [inputHandle, setInputHandle] = useState("");
  const [isConnectingHandle, setIsConnectingHandle] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

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

  const handleSyncMyStats = async () => {
    if (!user || !profile?.leetcode_username) return;
    setIsSyncing(true);
    setSyncSuccess(false);

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
      setConnectError("Could not sync LeetCode stats. Please try again.");
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
    } catch {
      setConnectError("Sync failed. Please try again.");
    } finally {
      setIsConnectingHandle(false);
    }
  };

  const sortedMembers = [...profiles].sort((a, b) => {
    switch (activeTab) {
      case "rating":
        return (b.contest_rating || 0) - (a.contest_rating || 0);
      case "streak":
        return (b.streak || 0) - (a.streak || 0);
      case "hard":
        return (b.total_hard || 0) - (a.total_hard || 0);
      case "easy":
        return (b.total_easy || 0) - (a.total_easy || 0);
      default:
        return 0;
    }
  });

  // Calculate my rank in current sorting
  const myRankIndex = user ? sortedMembers.findIndex((m) => m.id === user.id) : -1;
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : null;

  const totalMySolved =
    (profile?.total_easy || 0) + (profile?.total_medium || 0) + (profile?.total_hard || 0);

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
            Live rankings synchronized with LeetCode submissions.
          </p>
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center p-1 bg-white/[0.04] rounded-full border border-white/[0.06] overflow-x-auto self-start md:self-auto">
          <button
            onClick={() => setActiveTab("rating")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeTab === "rating"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            Contest Rating
          </button>
          <button
            onClick={() => setActiveTab("streak")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeTab === "streak"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            Daily Streak
          </button>
          <button
            onClick={() => setActiveTab("hard")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeTab === "hard"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            Hard Solved
          </button>
          <button
            onClick={() => setActiveTab("easy")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeTab === "easy"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            Speed Solvers
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
                Rating
              </span>
              <span className="text-lg font-black text-white font-mono leading-tight">
                {Math.round(profile.contest_rating)}
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

          <form onSubmit={handleConnectHandle} className="flex items-center gap-2 w-full md:w-auto">
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
                <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <span>Connect</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
          {connectError && (
            <div className="text-xs text-[#ff453a] font-medium w-full">{connectError}</div>
          )}
        </div>
      )}

      {/* ── Leaderboard Table ── */}
      <div className="bg-[#1c1c1e]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-subtle backdrop-blur-xl">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/[0.06] text-[11px] font-semibold text-white/30 uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4 md:col-span-3">Squad Member</div>
          <div className="col-span-2 text-center">Streak</div>
          <div className="col-span-2 text-center">Rating</div>
          <div className="col-span-3 md:col-span-2 text-center hidden sm:block">Solved (E/M/H)</div>
          <div className="col-span-3 md:col-span-2 text-right">Action</div>
        </div>

        {loading ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-white/40">
            <div className="w-6 h-6 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
            <span className="text-xs">Loading leaderboard...</span>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-xs">
            No profiles registered in this squad yet. When members log in or add their LeetCode handles, they will appear here.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {sortedMembers.map((member, index) => {
              const isCurrentUser = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className={cn(
                    "grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-white/[0.03] transition-colors group text-xs",
                    isCurrentUser && "bg-white/[0.04] border-l-2 border-l-[#fa586a]"
                  )}
                >
                  <div className="col-span-1 flex justify-center">
                    {getRankIndicator(index + 1)}
                  </div>

                  <div className="col-span-4 md:col-span-3 flex items-center gap-3 overflow-hidden">
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

                  <div className="col-span-2 flex justify-center">
                    <div className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/80 font-mono text-[11px] font-semibold">
                      {member.streak}d
                    </div>
                  </div>

                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <span className="font-mono font-bold text-white text-sm">
                      {Math.round(member.contest_rating)}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">
                      Rank #{member.global_rank || "—"}
                    </span>
                  </div>

                  <div className="col-span-3 md:col-span-2 hidden sm:flex items-center justify-center gap-1.5 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-[#30d158]/10 text-[#30d158] font-semibold">
                      {member.total_easy}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#ff9f0a]/10 text-[#ff9f0a] font-semibold">
                      {member.total_medium}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#ff453a]/10 text-[#ff453a] font-semibold">
                      {member.total_hard}
                    </span>
                  </div>

                  <div className="col-span-3 md:col-span-2 flex justify-end">
                    {!isCurrentUser ? (
                      <a
                        href={`/suggestions?to=${member.id}`}
                        className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#fa586a] hover:text-white border border-white/[0.08] text-white/60 text-xs font-semibold transition-all shadow-sm"
                      >
                        Challenge
                      </a>
                    ) : (
                      <span className="text-[11px] text-white/30 font-medium italic pr-2">
                        Your Standing
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
  );
}
