"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import {
  DPPattern,
  GraphPattern,
  TreePattern,
  BinarySearchPattern,
  SlidingWindowPattern,
  StackPattern,
} from "@/components/vectors/BentoPatterns";
import { getSquadProfiles } from "@/lib/data/profiles";
import { getAllLists, getAllProblems } from "@/lib/data/sheets";
import { getSuggestions } from "@/lib/data/suggestions";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Profile, CustomList, ListProblem } from "@/types/database";

interface TopicCategory {
  id: string;
  title: string;
  queryCategory: string;
  gradientClass: string;
  pattern: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: TopicCategory[] = [
  { id: "arrays-hashing", title: "Arrays & Hashing", queryCategory: "Arrays & Hashing", gradientClass: "gradient-crimson", pattern: SlidingWindowPattern },
  { id: "two-pointers", title: "Two Pointers", queryCategory: "Two Pointers", gradientClass: "gradient-sunset", pattern: SlidingWindowPattern },
  { id: "dynamic-programming", title: "Dynamic Programming", queryCategory: "Dynamic Programming", gradientClass: "gradient-purple", pattern: DPPattern },
  { id: "graphs", title: "Graphs", queryCategory: "Graphs", gradientClass: "gradient-amber", pattern: GraphPattern },
  { id: "trees-tries", title: "Trees & Tries", queryCategory: "Trees", gradientClass: "gradient-emerald", pattern: TreePattern },
  { id: "binary-search", title: "Binary Search", queryCategory: "Binary Search", gradientClass: "gradient-royal", pattern: BinarySearchPattern },
  { id: "backtracking", title: "Backtracking", queryCategory: "Backtracking", gradientClass: "gradient-violet", pattern: StackPattern },
  { id: "bit-manipulation", title: "Bit Manipulation", queryCategory: "Bit Manipulation", gradientClass: "gradient-rose", pattern: DPPattern },
];

export default function ArenaPage() {
  const { profile, user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { startSolving } = useSolving();

  const currentDisplayName = profile?.username || user?.email?.split("@")[0] || "Squad Member";

  useEffect(() => {
    async function loadArenaData() {
      try {
        const [profilesData, listsData, problemsData, suggestionsData] = await Promise.all([
          getSquadProfiles(),
          getAllLists(),
          getAllProblems(),
          getSuggestions(),
        ]);
        setProfiles(profilesData);
        setLists(listsData);
        setProblems(problemsData);
        setSuggestionsCount(suggestionsData.length);
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

  // Pick deterministic Problem of the Day from real database problems
  const potdIndex = problems.length > 0 ? (new Date().getDate() * 13) % problems.length : 0;
  const potd = problems[potdIndex] || null;

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-white/40">
        <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
        <span className="text-xs font-medium tracking-wide">Loading Arena...</span>
      </div>
    );
  }

  const handleStartPotd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (potd) {
      startSolving({
        id: potd.order_index,
        title: potd.title,
        slug: potd.title_slug,
        difficulty: potd.difficulty,
        category: potd.category,
      });
    }
  };

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

        {/* Currently Active User Status Pill */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] self-start md:self-auto shadow-sm">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#fa586a] to-[#ff8a9c] flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={currentDisplayName}
                className="w-full h-full object-cover"
              />
            ) : (
              currentDisplayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] animate-pulse" />
            <span className="font-semibold text-white truncate max-w-[140px]">{currentDisplayName}</span>
            <span className="text-white/40 text-[11px]">active</span>
          </div>
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
          {potd ? (
            <div
              onClick={handleStartPotd}
              className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-crimson border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer"
            >
              <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                <DPPattern />
              </div>
              <div className="relative z-10 flex justify-between items-start">
                <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                  Problem of the Day
                </span>
                <span className="text-white/80 font-mono text-xs font-bold">#{potd.order_index}</span>
              </div>

              <div className="relative z-10">
                <div className="text-[11px] text-white/80 font-medium mb-1">
                  {potd.category} • {potd.difficulty}
                </div>
                <h3 className="text-xl font-bold text-white leading-snug truncate">
                  {potd.title}
                </h3>
                <div className="text-xs text-white/70 mt-1 flex items-center gap-1.5 font-medium">
                  <Play className="w-3 h-3 fill-current" />
                  <span>Click to start solving</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-crimson border border-white/10 flex flex-col justify-between shadow-subtle">
              <div className="relative z-10">
                <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                  Problem of the Day
                </span>
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-white">Daily Challenge</h3>
                <p className="text-xs text-white/70 mt-1">Check back once roadmaps are loaded</p>
              </div>
            </div>
          )}

          {/* Card 2: Streak Guardian */}
          <Link
            href="/leaderboard"
            className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-sunset border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer"
          >
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <SlidingWindowPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                Streak Guardian
              </span>
              <span className="text-white/80 text-xs font-mono font-bold">
                {totalStreak > 0 ? "ACTIVE" : "IDLE"}
              </span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Squad Combined Streak
              </div>
              <h3 className="text-2xl font-black text-white">
                {totalStreak} {totalStreak === 1 ? "Day" : "Days"}
              </h3>
              <p className="text-xs text-white/80 mt-1">
                {topMember && topMember.streak > 0
                  ? `@${topMember.username} leads with ${topMember.streak}d`
                  : "Solve a problem today to start squad streak"}
              </p>
            </div>
          </Link>

          {/* Card 3: Upcoming Contest */}
          <Link
            href="/leaderboard"
            className="relative h-64 rounded-2xl p-5 overflow-hidden gradient-purple border border-white/10 flex flex-col justify-between shadow-subtle group hover:scale-[1.01] transition-all cursor-pointer"
          >
            <div className="absolute inset-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <GraphPattern />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 uppercase tracking-wider border border-white/15">
                Contest Arena
              </span>
              <span className="text-white/80 font-mono text-xs font-bold">RATED</span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Leaderboard Standings
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                {topMember ? `${Math.round(topMember.contest_rating)} Rating` : "Contest Ratings"}
              </h3>
              <p className="text-xs text-white/80 mt-1 truncate">
                {topMember ? `@${topMember.username} leads rating` : "Sync your LeetCode handle"}
              </p>
            </div>
          </Link>

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
              <span className="text-white/80 font-mono text-xs font-bold">
                {suggestionsCount} OPEN
              </span>
            </div>

            <div className="relative z-10">
              <div className="text-[11px] text-white/80 font-medium mb-1">
                Peer Challenges
              </div>
              <h3 className="text-xl font-bold text-white leading-snug">
                {suggestionsCount > 0 ? `${suggestionsCount} Challenges` : "Challenge Squad"}
              </h3>
              <p className="text-xs text-white/70 mt-1">
                {suggestionsCount > 0
                  ? "Solve peer suggestions with intuition notes"
                  : "Recommend a problem to your squad"}
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
                href={`/sheets/neetcode-150?category=${encodeURIComponent(cat.queryCategory)}`}
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
