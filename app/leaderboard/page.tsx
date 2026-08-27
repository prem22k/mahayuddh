"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Award,
  Inbox,
  ExternalLink,
  Loader2,
} from "lucide-react";
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

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-6 h-6 rounded-full bg-apple-yellow/20 text-apple-yellow flex items-center justify-center font-bold text-xs border border-apple-yellow/40">
            🥇
          </div>
        );
      case 2:
        return (
          <div className="w-6 h-6 rounded-full bg-txt-secondary/20 text-txt-primary flex items-center justify-center font-bold text-xs border border-txt-secondary/40">
            🥈
          </div>
        );
      case 3:
        return (
          <div className="w-6 h-6 rounded-full bg-apple-orange/20 text-apple-orange flex items-center justify-center font-bold text-xs border border-apple-orange/40">
            🥉
          </div>
        );
      default:
        return <span className="font-mono text-xs text-txt-tertiary font-bold">{rank}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-apple-accent tracking-wider uppercase mb-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Competitive Standings</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            Leaderboard
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            Live rankings queried directly from Supabase and synchronized with LeetCode.
          </p>
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center p-1 bg-surface-sidebar rounded-pill border border-border-subtle overflow-x-auto self-start md:self-auto">
          <button
            onClick={() => setActiveTab("rating")}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "rating"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Contest Masters</span>
          </button>
          <button
            onClick={() => setActiveTab("streak")}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "streak"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Streak Kings</span>
          </button>
          <button
            onClick={() => setActiveTab("hard")}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "hard"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Hard Hunters</span>
          </button>
          <button
            onClick={() => setActiveTab("easy")}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "easy"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Speed Solvers</span>
          </button>
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="bg-surface-sidebar border border-border-subtle rounded-2xl overflow-hidden shadow-subtle">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border-subtle text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4 md:col-span-3">Squad Member</div>
          <div className="col-span-2 text-center">Streak</div>
          <div className="col-span-2 text-center">Contest Rating</div>
          <div className="col-span-3 md:col-span-2 text-center hidden sm:block">Breakdown (E/M/H)</div>
          <div className="col-span-3 md:col-span-2 text-right">Action</div>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center gap-3 text-txt-secondary">
            <Loader2 className="w-6 h-6 animate-spin text-apple-accent" />
            <span className="text-xs">Loading leaderboard from Supabase...</span>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="p-12 text-center text-txt-secondary text-xs">
            No profiles registered in this squad yet. When members log in or add their LeetCode handles, they will appear here!
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {sortedMembers.map((member, index) => (
              <div
                key={member.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-raised transition-colors group text-xs"
              >
                <div className="col-span-1 flex justify-center">
                  {getRankBadge(index + 1)}
                </div>

                <div className="col-span-4 md:col-span-3 flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-surface-muted border border-border-subtle flex items-center justify-center font-bold text-txt-primary shrink-0 group-hover:border-apple-accent/40 transition-colors">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatar_url} alt={member.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-txt-primary truncate group-hover:text-apple-accent transition-colors">
                      {member.username}
                    </span>
                    <a
                      href={`https://leetcode.com/${member.leetcode_username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-txt-secondary hover:underline flex items-center gap-1"
                    >
                      <span>@{member.leetcode_username}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  </div>
                </div>

                <div className="col-span-2 flex justify-center">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-apple-accent/15 border border-apple-accent/30 text-apple-accent font-bold">
                    <Flame className="w-3.5 h-3.5 fill-apple-accent" />
                    <span>{member.streak}d</span>
                  </div>
                </div>

                <div className="col-span-2 flex flex-col items-center justify-center">
                  <span className="font-mono font-bold text-txt-primary text-sm">
                    {Math.round(member.contest_rating)}
                  </span>
                  <span className="text-[10px] text-txt-tertiary">
                    Rank #{member.global_rank || "—"}
                  </span>
                </div>

                <div className="col-span-3 md:col-span-2 hidden sm:flex items-center justify-center gap-1.5 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-apple-green/10 text-apple-green font-semibold">
                    {member.total_easy}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-apple-orange/10 text-apple-orange font-semibold">
                    {member.total_medium}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-apple-red/10 text-apple-red font-semibold">
                    {member.total_hard}
                  </span>
                </div>

                <div className="col-span-3 md:col-span-2 flex justify-end">
                  <a
                    href={`/suggestions?to=${member.id}`}
                    className="px-3 py-1.5 rounded-pill bg-surface-muted hover:bg-apple-accent hover:text-white border border-border-subtle text-txt-secondary text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Inbox className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Challenge</span>
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
