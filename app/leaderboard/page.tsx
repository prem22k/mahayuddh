"use client";

import React, { useState } from "react";
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Award,
  Inbox,
  ExternalLink,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LeaderboardTab = "weekly" | "contest" | "streak" | "hard";

interface SquadMember {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatar: string;
  streak: number;
  contestRating: number;
  ratingDelta: number;
  weeklySolved: number;
  totalEasy: number;
  totalMedium: number;
  totalHard: number;
  totalSolved: number;
}

const SAMPLE_MEMBERS: SquadMember[] = [
  {
    id: "1",
    rank: 1,
    name: "Prem Sai Kota",
    handle: "premsaik",
    avatar: "P",
    streak: 14,
    contestRating: 1942,
    ratingDelta: 45,
    weeklySolved: 18,
    totalEasy: 45,
    totalMedium: 92,
    totalHard: 21,
    totalSolved: 158,
  },
  {
    id: "2",
    rank: 2,
    name: "Rahul K",
    handle: "rahulk_dev",
    avatar: "R",
    streak: 11,
    contestRating: 1885,
    ratingDelta: 28,
    weeklySolved: 14,
    totalEasy: 40,
    totalMedium: 84,
    totalHard: 16,
    totalSolved: 140,
  },
  {
    id: "3",
    rank: 3,
    name: "Arjun V",
    handle: "arjun_v",
    avatar: "A",
    streak: 7,
    contestRating: 1760,
    ratingDelta: -12,
    weeklySolved: 10,
    totalEasy: 50,
    totalMedium: 65,
    totalHard: 12,
    totalSolved: 127,
  },
  {
    id: "4",
    rank: 4,
    name: "Sneha M",
    handle: "sneha_codes",
    avatar: "S",
    streak: 5,
    contestRating: 1695,
    ratingDelta: 15,
    weeklySolved: 8,
    totalEasy: 60,
    totalMedium: 48,
    totalHard: 8,
    totalSolved: 116,
  },
];

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("weekly");

  const sortedMembers = [...SAMPLE_MEMBERS].sort((a, b) => {
    switch (activeTab) {
      case "weekly":
        return b.weeklySolved - a.weeklySolved;
      case "contest":
        return b.contestRating - a.contestRating;
      case "streak":
        return b.streak - a.streak;
      case "hard":
        return b.totalHard - a.totalHard;
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
        </div>

        {/* View Mode Filters (Apple Style Pill Bar) */}
        <div className="flex items-center p-1 bg-surface-sidebar rounded-pill border border-border-subtle overflow-x-auto self-start md:self-auto">
          <button
            onClick={() => setActiveTab("weekly")}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "weekly"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Weekly Grind</span>
          </button>
          <button
            onClick={() => setActiveTab("contest")}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "contest"
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
        </div>
      </div>

      {/* Tracklist Table Container */}
      <div className="bg-surface-sidebar border border-border-subtle rounded-2xl overflow-hidden shadow-subtle">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border-subtle text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4 md:col-span-3">Squad Member</div>
          <div className="col-span-2 text-center">Streak</div>
          <div className="col-span-2 text-center">Contest Rating</div>
          <div className="col-span-3 md:col-span-2 text-center hidden sm:block">Breakdown (E/M/H)</div>
          <div className="col-span-3 md:col-span-2 text-right">Action</div>
        </div>

        {/* Tracklist Rows */}
        <div className="divide-y divide-border-subtle">
          {sortedMembers.map((member, index) => (
            <div
              key={member.id}
              className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-raised transition-colors group text-xs"
            >
              {/* Rank */}
              <div className="col-span-1 flex justify-center">
                {getRankBadge(index + 1)}
              </div>

              {/* Name & Handle */}
              <div className="col-span-4 md:col-span-3 flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-surface-muted border border-border-subtle flex items-center justify-center font-bold text-txt-primary shrink-0 group-hover:border-apple-accent/40 transition-colors">
                  {member.avatar}
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-bold text-txt-primary truncate group-hover:text-apple-accent transition-colors">
                    {member.name}
                  </span>
                  <a
                    href={`https://leetcode.com/${member.handle}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-txt-secondary hover:underline flex items-center gap-1"
                  >
                    <span>@{member.handle}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                </div>
              </div>

              {/* Streak */}
              <div className="col-span-2 flex justify-center">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-apple-accent/15 border border-apple-accent/30 text-apple-accent font-bold">
                  <Flame className="w-3.5 h-3.5 fill-apple-accent" />
                  <span>{member.streak}d</span>
                </div>
              </div>

              {/* Contest Rating */}
              <div className="col-span-2 flex flex-col items-center justify-center">
                <span className="font-mono font-bold text-txt-primary text-sm">
                  {member.contestRating}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold flex items-center gap-0.5",
                    member.ratingDelta >= 0 ? "text-apple-green" : "text-apple-red"
                  )}
                >
                  {member.ratingDelta >= 0 ? `+${member.ratingDelta}` : member.ratingDelta}
                </span>
              </div>

              {/* Solved Breakdown Pills */}
              <div className="col-span-3 md:col-span-2 hidden sm:flex items-center justify-center gap-1.5 font-mono text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-apple-green/10 text-apple-green font-semibold">
                  {member.totalEasy}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-apple-orange/10 text-apple-orange font-semibold">
                  {member.totalMedium}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-apple-red/10 text-apple-red font-semibold">
                  {member.totalHard}
                </span>
              </div>

              {/* Quick Suggest Action */}
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
      </div>
    </div>
  );
}
