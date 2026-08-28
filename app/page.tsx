"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  DPPattern,
  GraphPattern,
  TreePattern,
  BinarySearchPattern,
  SlidingWindowPattern,
  StackPattern,
} from "@/components/vectors/BentoPatterns";
import { getSquadProfiles } from "@/lib/data/profiles";
import { getAllLists } from "@/lib/data/sheets";
import { Profile, CustomList } from "@/types/database";

interface TopicCategory {
  id: string;
  title: string;
  gradientClass: string;
  pattern: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: TopicCategory[] = [
  { id: "arrays-hashing", title: "Arrays & Hashing", gradientClass: "gradient-crimson", pattern: SlidingWindowPattern },
  { id: "two-pointers", title: "Two Pointers & Window", gradientClass: "gradient-sunset", pattern: SlidingWindowPattern },
  { id: "dynamic-programming", title: "Dynamic Programming", gradientClass: "gradient-purple", pattern: DPPattern },
  { id: "graphs", title: "Graphs & BFS/DFS", gradientClass: "gradient-amber", pattern: GraphPattern },
  { id: "trees-tries", title: "Trees & Tries", gradientClass: "gradient-emerald", pattern: TreePattern },
  { id: "binary-search", title: "Binary Search & Stack", gradientClass: "gradient-royal", pattern: BinarySearchPattern },
  { id: "backtracking", title: "Backtracking & Recursion", gradientClass: "gradient-violet", pattern: StackPattern },
  { id: "bit-manipulation", title: "Bit Manipulation & Math", gradientClass: "gradient-rose", pattern: DPPattern },
];

export default function ArenaPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadArenaData() {
      try {
        const [profilesData, listsData] = await Promise.all([
          getSquadProfiles(),
          getAllLists(),
        ]);
        setProfiles(profilesData);
        setLists(listsData);
      } catch (err) {
        console.error("Error loading Arena data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadArenaData();
  }, []);

  const totalStreak = profiles.reduce((acc, p) => acc + (p.streak || 0), 0);
  const topMember = profiles[0];

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-white/40">
        <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
        <span className="text-xs font-medium tracking-wide">Loading Arena...</span>
      </div>
    );
  }

  return (
    <div className="space-y-9 select-none">
      {/* ── Page Title Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Developer Squad
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Arena
          </h1>
        </div>

        {/* Squad Status Pill */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          {profiles.length > 0 ? (
            <div className="flex -space-x-2 overflow-hidden">
              {profiles.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-black bg-white/[0.08] text-white text-[11px] font-bold flex items-center justify-center border border-white/10"
                >
                  {p.username.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          ) : null}
          <span className="text-xs text-white/40 font-medium tracking-wide">
            {profiles.length} squad members active
          </span>
        </div>
      </div>

      {/* ── 1. TOP PICKS FOR SQUAD ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Top Picks for Squad
          </h2>
          <span className="text-xs text-white/40 font-medium">
            Daily Highlights
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: POTD */}
          <Link
            href="/sheets/neetcode-150"
            className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-crimson border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
              <DPPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                Problem of the Day
              </span>
              <span className="text-white/80 font-mono text-xs font-bold">#15</span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Two Pointers • Medium
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                3Sum
              </h3>
              <p className="text-xs text-white/70 mt-1">
                Solve and auto-sync today
              </p>
            </div>
          </Link>

          {/* Card 2: Streak Guardian */}
          <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-sunset border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer">
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <SlidingWindowPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                Streak Guardian
              </span>
              <span className="text-white/80 text-xs font-mono font-bold">ACTIVE</span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Squad Combined Streak
              </div>
              <h3 className="text-2xl font-black text-white">
                {totalStreak} Days
              </h3>
              <p className="text-xs text-white/80 mt-1">
                Protect streak before midnight
              </p>
            </div>
          </div>

          {/* Card 3: Upcoming Contest */}
          <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-purple border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer">
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <GraphPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                Weekly Battle
              </span>
              <span className="text-white/80 font-mono text-xs font-bold">RATED</span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Upcoming Contest
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                Weekly Contest
              </h3>
              <p className="text-xs text-white/80 mt-1">
                {topMember ? `@${topMember.username} leads rating` : "Squad ready"}
              </p>
            </div>
          </div>

          {/* Card 4: Suggestions Hub */}
          <Link
            href="/suggestions"
            className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-royal border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all"
          >
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <BinarySearchPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                Suggestion Box
              </span>
              <span className="text-white/80 font-mono text-xs font-bold">PEER</span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Peer Challenges
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                Challenge Squad
              </h3>
              <p className="text-xs text-white/70 mt-1">
                Recommend problems with intuition notes
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* ── 2. BROWSE DSA TOPICS ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Browse Topics
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Structured patterns backed by roadmaps
            </p>
          </div>
          <Link
            href="/sheets/neetcode-150"
            className="text-xs text-[#fa586a] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View All ({lists.length} Sheets)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const PatternComponent = cat.pattern;

            return (
              <Link
                key={cat.id}
                href={`/sheets/neetcode-150`}
                className={`relative aspect-[16/10] rounded-2xl p-4 overflow-hidden ${cat.gradientClass} border border-white/10 shadow-subtle group hover:scale-[1.02] transition-transform flex flex-col justify-between`}
              >
                <div className="absolute inset-0 group-hover:scale-105 transition-transform">
                  <PatternComponent />
                </div>

                <div className="relative z-10 flex justify-end">
                  <span className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/15">
                    Roadmap
                  </span>
                </div>

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
    </div>
  );
}
