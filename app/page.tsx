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
import { getAllLists, getAllProblems, getUserStatusesBySlugs, toStatusMap } from "@/lib/data/sheets";
import { getPendingSuggestionCount } from "@/lib/data/suggestions";
import { getCatalogTopicsSummary } from "@/lib/data/problems";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Profile, CustomList, ListProblem, TriState } from "@/types/database";

const GRADIENTS = [
  "gradient-crimson",
  "gradient-sunset",
  "gradient-purple",
  "gradient-amber",
  "gradient-emerald",
  "gradient-royal",
  "gradient-violet",
  "gradient-rose",
];

const PATTERNS = [
  SlidingWindowPattern,
  DPPattern,
  GraphPattern,
  TreePattern,
  BinarySearchPattern,
  StackPattern,
];

export default function ArenaPage() {
  const { profile, user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { startSolving } = useSolving();

  // Catalog + correctness
  const [topics, setTopics] = useState<{ topic: string; count: number; solved: number; attempted: number }[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, TriState>>({});
  const [showAllTopics, setShowAllTopics] = useState(false);

  const currentDisplayName = profile?.username || user?.email?.split("@")[0] || "Squad Member";

  useEffect(() => {
    async function loadArenaData() {
      try {
        const [profilesData, listsData, problemsData, pendingCount, userStatuses] =
          await Promise.all([
            getSquadProfiles(),
            getAllLists(),
            getAllProblems(),
            getPendingSuggestionCount(),
            user ? getUserStatusesBySlugs(user.id) : Promise.resolve([]),
          ]);
        setProfiles(profilesData);
        setLists(listsData);
        setProblems(problemsData);
        setSuggestionsCount(pendingCount);
        const userMap = toStatusMap(userStatuses);
        setStatusMap(userMap);
        // Topic summary depends on the user's status map, so compute it after.
        setTopics(await getCatalogTopicsSummary(userMap));
      } catch (err) {
        console.error("Error loading Arena data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadArenaData();
  }, [user]);

  const totalStreak = profiles.reduce((acc, p) => acc + (p.streak || 0), 0);
  const topMember = profiles[0];
  const streakLeader = profiles.reduce<Profile | null>(
    (best, p) => (!best || (p.streak || 0) > (best.streak || 0) ? p : best),
    null
  );

  // Pick deterministic Problem of the Day from real database problems
  const potdIndex = problems.length > 0 ? (new Date().getDate() * 13) % problems.length : 0;
  const potd = problems[potdIndex] || null;

  // Primary list slug to link to
  const primaryListSlug = lists[0]?.slug || "neetcode-150";

  // Global progress from the user's status map vs the full catalog size.
  const totalSolved = Object.values(statusMap).filter((s) => s === "solved").length;
  const totalAttempted = Object.values(statusMap).filter((s) => s === "attempted").length;
  const catalogTotal = topics.reduce((acc, t) => acc + t.count, 0) || 0;

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
                {streakLeader && streakLeader.streak > 0
                  ? `@${streakLeader.username} leads with ${streakLeader.streak}d`
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

      {/* ── 1.5 YOUR PROGRESS ── */}
      {user && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Your Progress</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Solved", value: totalSolved, total: catalogTotal, color: "#30d158" },
              { label: "Attempted", value: totalAttempted, total: catalogTotal, color: "#ff9f0a" },
              { label: "Catalog", value: catalogTotal, total: catalogTotal, color: "#fa586a" },
            ].map((stat) => {
              const pct = stat.total > 0 ? Math.round((stat.value / stat.total) * 100) : 0;
              return (
                <div
                  key={stat.label}
                  className="relative h-28 rounded-2xl p-4 overflow-hidden bg-[#1c1c1e]/60 border border-white/[0.06] shadow-subtle flex flex-col justify-between"
                >
                  <span className="text-[11px] text-white/40 font-medium">{stat.label}</span>
                  <div>
                    <div className="text-2xl font-black text-white leading-none">{stat.value}</div>
                    {stat.label !== "Catalog" && (
                      <div className="text-[11px] text-white/40 mt-1">{pct}% of catalog</div>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: stat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 2. BROWSE DSA TOPICS ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Browse Topics
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {catalogTotal > 0 ? `${catalogTotal} problems across ${topics.length} LeetCode topics` : "Structured patterns backed by roadmaps"}
            </p>
          </div>
          {topics.length > 24 && (
            <button
              onClick={() => setShowAllTopics((v) => !v)}
              className="text-xs text-[#fa586a] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>{showAllTopics ? "Show Less" : `Show All (${topics.length})`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(showAllTopics ? topics : topics.slice(0, 24)).map((t, idx) => {
            const PatternComponent = PATTERNS[idx % PATTERNS.length];
            const gradientClass = GRADIENTS[idx % GRADIENTS.length];
            const solvedPct = t.count > 0 ? (t.solved / t.count) * 100 : 0;
            const attemptedPct = t.count > 0 ? (t.attempted / t.count) * 100 : 0;

            return (
              <Link
                key={t.topic}
                href={`/sheets/${primaryListSlug}?topic=${encodeURIComponent(t.topic)}`}
                className={`relative aspect-[16/10] rounded-2xl p-4 overflow-hidden ${gradientClass} border border-white/10 shadow-subtle group hover:scale-[1.02] transition-transform flex flex-col justify-between`}
              >
                <div className="absolute inset-0 group-hover:scale-105 transition-transform opacity-30">
                  <PatternComponent />
                </div>

                <div className="relative z-10 flex justify-between items-start">
                  <span className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/15">
                    {t.count} {t.count === 1 ? "Problem" : "Problems"}
                  </span>
                  {user && (t.solved > 0 || t.attempted > 0) && (
                    <span className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/15">
                      {t.solved}/{t.count} ✓
                    </span>
                  )}
                </div>

                <div className="relative z-10">
                  <h3 className="text-xs md:text-sm font-extrabold text-white leading-tight drop-shadow-md">
                    {t.topic}
                  </h3>
                  {user && t.count > 0 && (
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
                      <div style={{ width: `${solvedPct}%`, backgroundColor: "#30d158" }} />
                      <div style={{ width: `${attemptedPct}%`, backgroundColor: "#ff9f0a" }} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
