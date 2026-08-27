"use client";

import React from "react";
import Link from "next/link";
import {
  Flame,
  Clock,
  Trophy,
  ArrowRight,
  TrendingUp,
  Inbox,
  CheckCircle2,
  ExternalLink,
  Users,
  Sparkles,
} from "lucide-react";
import {
  DPPattern,
  GraphPattern,
  TreePattern,
  BinarySearchPattern,
  SlidingWindowPattern,
  StackPattern,
} from "@/components/vectors/BentoPatterns";

interface TopicCategory {
  id: string;
  title: string;
  gradientClass: string;
  solvedCount: number;
  totalCount: number;
  pattern: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: TopicCategory[] = [
  {
    id: "arrays-hashing",
    title: "Arrays & Hashing",
    gradientClass: "gradient-crimson",
    solvedCount: 28,
    totalCount: 32,
    pattern: SlidingWindowPattern,
  },
  {
    id: "two-pointers",
    title: "Two Pointers & Window",
    gradientClass: "gradient-sunset",
    solvedCount: 19,
    totalCount: 22,
    pattern: SlidingWindowPattern,
  },
  {
    id: "dynamic-programming",
    title: "Dynamic Programming",
    gradientClass: "gradient-purple",
    solvedCount: 14,
    totalCount: 45,
    pattern: DPPattern,
  },
  {
    id: "graphs",
    title: "Graphs & BFS/DFS",
    gradientClass: "gradient-amber",
    solvedCount: 16,
    totalCount: 30,
    pattern: GraphPattern,
  },
  {
    id: "trees-tries",
    title: "Trees & Tries",
    gradientClass: "gradient-emerald",
    solvedCount: 22,
    totalCount: 25,
    pattern: TreePattern,
  },
  {
    id: "binary-search",
    title: "Binary Search & Stack",
    gradientClass: "gradient-royal",
    solvedCount: 15,
    totalCount: 18,
    pattern: BinarySearchPattern,
  },
  {
    id: "backtracking",
    title: "Backtracking & Recursion",
    gradientClass: "gradient-violet",
    solvedCount: 8,
    totalCount: 12,
    pattern: StackPattern,
  },
  {
    id: "bit-manipulation",
    title: "Bit Manipulation & Math",
    gradientClass: "gradient-rose",
    solvedCount: 6,
    totalCount: 10,
    pattern: DPPattern,
  },
];

const RECENT_FEED = [
  {
    id: "1",
    user: "Rahul K",
    avatar: "R",
    action: "solved",
    problem: "Longest Increasing Subsequence",
    difficulty: "Medium",
    slug: "longest-increasing-subsequence",
    time: "14m ago",
  },
  {
    id: "2",
    user: "Arjun V",
    avatar: "A",
    action: "streak",
    details: "hit a 7-day streak! 🔥",
    time: "1h ago",
  },
  {
    id: "3",
    user: "Prem Sai",
    avatar: "P",
    action: "solved",
    problem: "Trapping Rain Water",
    difficulty: "Hard",
    slug: "trapping-rain-water",
    time: "3h ago",
  },
  {
    id: "4",
    user: "Sneha M",
    avatar: "S",
    action: "suggested",
    details: "suggested 'Word Ladder' to Rahul K",
    time: "4h ago",
  },
];

export default function ArenaPage() {
  return (
    <div className="space-y-9">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-apple-accent tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Developer Squad Arena</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            Arena
          </h1>
        </div>

        {/* Squad Status Pill */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex -space-x-2 overflow-hidden">
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-surface-base bg-apple-purple text-white text-xs font-bold flex items-center justify-center">
              P
            </div>
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-surface-base bg-apple-blue text-white text-xs font-bold flex items-center justify-center">
              R
            </div>
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-surface-base bg-apple-green text-white text-xs font-bold flex items-center justify-center">
              A
            </div>
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-surface-base bg-apple-orange text-white text-xs font-bold flex items-center justify-center">
              S
            </div>
          </div>
          <span className="text-xs text-txt-secondary font-medium">
            4 / 4 Squad Active Today
          </span>
        </div>
      </div>

      {/* 1. TOP PICKS FOR SQUAD (Hero Cards Section - Modeled after Apple Music) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-txt-primary tracking-tight flex items-center gap-2">
            <span>Top Picks for Squad</span>
          </h2>
          <span className="text-xs text-txt-secondary font-medium">
            Curated daily highlights
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: POTD */}
          <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-crimson border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer">
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
              <DPPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/20">
                Problem of the Day
              </span>
              <span className="text-white text-xs font-bold">⚔️ #15</span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Two Pointers • Medium
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                3Sum
              </h3>
              <p className="text-xs text-white/70 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-apple-green" />
                <span>3/5 friends solved</span>
              </p>
            </div>
          </div>

          {/* Card 2: Streak Guardian */}
          <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-sunset border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer">
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <SlidingWindowPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/20">
                Streak Guardian
              </span>
              <Flame className="w-4 h-4 text-white fill-white" />
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Daily Consistency
              </div>
              <h3 className="text-2xl font-black text-white">
                14-Day Streak 🔥
              </h3>
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>2h 45m left to solve today</span>
              </p>
            </div>
          </div>

          {/* Card 3: Upcoming Contest */}
          <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-purple border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer">
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <GraphPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/20">
                Weekend Battle
              </span>
              <Trophy className="w-4 h-4 text-white" />
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Saturday • 8:00 PM IST
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                Biweekly 148
              </h3>
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>4 squad members registered</span>
              </p>
            </div>
          </div>

          {/* Card 4: Top Suggestion */}
          <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-royal border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer">
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <BinarySearchPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/20">
                Friend Challenge
              </span>
              <Inbox className="w-4 h-4 text-white" />
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                From Rahul K • Hard
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                Word Ladder II
              </h3>
              <p className="text-xs text-white/70 mt-1 line-clamp-1 italic">
                &ldquo;Notice level-by-level BFS optimization&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BROWSE DSA TOPICS (Category Bento Grid - Modeled after Apple Music Browse) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-txt-primary tracking-tight">
              Browse DSA Topics
            </h2>
            <p className="text-xs text-txt-secondary mt-0.5">
              Structured patterns with algorithmic progress rings
            </p>
          </div>
          <Link
            href="/sheets/neetcode-150"
            className="text-xs text-apple-accent hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View Complete Roadmap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const PatternComponent = cat.pattern;
            const progressPercent = Math.round((cat.solvedCount / cat.totalCount) * 100);

            return (
              <Link
                key={cat.id}
                href={`/sheets/neetcode-150?category=${cat.id}`}
                className={`relative aspect-[16/10] rounded-2xl p-4 overflow-hidden ${cat.gradientClass} border border-white/10 shadow-subtle group hover:scale-[1.02] transition-transform flex flex-col justify-between`}
              >
                {/* Algorithmic SVG Background */}
                <div className="absolute inset-0 group-hover:scale-105 transition-transform">
                  <PatternComponent />
                </div>

                {/* Progress Chip */}
                <div className="relative z-10 flex justify-end">
                  <span className="px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                    {cat.solvedCount} / {cat.totalCount} ({progressPercent}%)
                  </span>
                </div>

                {/* Card Title */}
                <div className="relative z-10">
                  <h3 className="text-base md:text-lg font-extrabold text-white leading-tight drop-shadow-md">
                    {cat.title}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. LIVE SQUAD ACTIVITY FEED */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-txt-primary tracking-tight">
            Live Squad Feed
          </h2>
          <span className="text-xs text-txt-secondary">Real-time LeetCode sync</span>
        </div>

        <div className="bg-surface-sidebar border border-border-subtle rounded-2xl divide-y divide-border-subtle overflow-hidden">
          {RECENT_FEED.map((item) => (
            <div
              key={item.id}
              className="p-3.5 hover:bg-surface-raised transition-colors flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-muted border border-border-subtle flex items-center justify-center font-bold text-txt-primary">
                  {item.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-txt-primary">{item.user}</span>
                    {item.action === "solved" && (
                      <>
                        <span className="text-txt-secondary">solved</span>
                        <span className="font-semibold text-txt-primary hover:text-apple-accent cursor-pointer">
                          {item.problem}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            item.difficulty === "Hard"
                              ? "text-apple-red bg-apple-red/10"
                              : "text-apple-orange bg-apple-orange/10"
                          }`}
                        >
                          {item.difficulty}
                        </span>
                      </>
                    )}
                    {item.details && (
                      <span className="text-txt-secondary">{item.details}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-txt-tertiary">{item.time}</span>
                </div>
              </div>

              {item.slug && (
                <a
                  href={`https://leetcode.com/problems/${item.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-txt-secondary hover:text-txt-primary rounded-md"
                  aria-label={`View ${item.problem} on LeetCode`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
