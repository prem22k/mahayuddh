"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSquadProfiles } from "@/lib/data/profiles";
import { Profile } from "@/types/database";

type LeaderboardTab = "rating" | "streak" | "hard" | "easy";

export default function LeaderboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("rating");

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);
      try {
        const data = await getSquadProfiles();
        setProfiles(data);
      } catch (err) {
        console.error("Error loading profiles:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, []);

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
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Standings
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Leaderboard
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Live rankings synchronized with LeetCode submissions.
          </p>
        </div>

        {/* View Mode Filters (Apple Music Clean Pills) */}
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

      {/* ── Tracklist Table ── */}
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
            {sortedMembers.map((member, index) => (
              <div
                key={member.id}
                className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-white/[0.03] transition-colors group text-xs"
              >
                <div className="col-span-1 flex justify-center">
                  {getRankIndicator(index + 1)}
                </div>

                <div className="col-span-4 md:col-span-3 flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-white text-[11px] shrink-0 group-hover:border-[#fa586a]/40 transition-colors">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatar_url} alt={member.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="font-semibold text-white truncate group-hover:text-[#fa586a] transition-colors">
                      {member.username}
                    </span>
                    <a
                      href={`https://leetcode.com/${member.leetcode_username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 font-mono"
                    >
                      <span>@{member.leetcode_username}</span>
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
                  <a
                    href={`/suggestions?to=${member.id}`}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#fa586a] hover:text-white border border-white/[0.08] text-white/60 text-xs font-semibold transition-all shadow-sm"
                  >
                    Challenge
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
