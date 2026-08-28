"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Link2,
  Shield,
  Flame,
  Trophy,
  MessageSquare,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
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
import { getCatalogTopicsSummary, getCatalogCount } from "@/lib/data/problems";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConnectLeetCodeModal } from "@/components/modals/ConnectLeetCodeModal";
import { UserStatsDossierModal } from "@/components/profile/UserStatsDossierModal";
import { Profile, CustomList, ListProblem, TriState } from "@/types/database";
import { cn } from "@/lib/utils";

const TOPIC_SURFACES = [
  "apple-card-crimson",
  "apple-card-sapphire",
  "apple-card-amber",
  "apple-card-emerald",
  "apple-card-indigo",
  "apple-card-cyan",
  "apple-card-rose",
  "apple-card-gold",
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
  const { profile, user, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [catalogCount, setCatalogCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { startSolving } = useSolving();

  // Catalog + correctness
  const [topics, setTopics] = useState<{ topic: string; count: number; solved: number; attempted: number }[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, TriState>>({});
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [refreshKey] = useState(0);

  const currentDisplayName = profile?.username || user?.email?.split("@")[0] || "Squad Member";

  useEffect(() => {
    async function loadArenaData() {
      try {
        const [profilesData, listsData, problemsData, pendingCount, userStatuses, totalCatalog] =
          await Promise.all([
            getSquadProfiles(),
            getAllLists(),
            getAllProblems(),
            getPendingSuggestionCount(),
            user ? getUserStatusesBySlugs(user.id) : Promise.resolve([]),
            getCatalogCount(),
          ]);
        setProfiles(profilesData);
        setLists(listsData);
        setProblems(problemsData);
        setSuggestionsCount(pendingCount);
        setCatalogCount(totalCatalog);
        const userMap = toStatusMap(userStatuses);
        setStatusMap(userMap);
        // Topic summary depends on the user's status map
        setTopics(await getCatalogTopicsSummary(userMap));
      } catch (err) {
        console.error("Error loading Arena data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadArenaData();
  }, [user, refreshKey]);

  // Listen for problem-status-changed events across open tabs & dock
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const custom = e as CustomEvent<{ slug: string; status: TriState }>;
      if (custom.detail?.slug) {
        setStatusMap((prev) => ({
          ...prev,
          [custom.detail.slug]: custom.detail.status,
        }));
      }
    };
    window.addEventListener("problem-status-changed", handleStatusChange);
    return () => window.removeEventListener("problem-status-changed", handleStatusChange);
  }, []);

  const totalStreak = profiles.reduce((acc, p) => acc + (p.streak || 0), 0);
  const topMember = profiles[0];
  const streakLeader = profiles.reduce<Profile | null>(
    (best, p) => (!best || (p.streak || 0) > (best.streak || 0) ? p : best),
    null
  );

  // Pick deterministic Problem of the Day from real database problems
  const potdIndex = problems.length > 0 ? (new Date().getDate() * 13) % problems.length : 0;
  const potd = problems[potdIndex] || null;
  const isPotdSolved = potd?.title_slug ? statusMap[potd.title_slug.toLowerCase()] === "solved" : false;

  // Primary list slug to link to
  const primaryListSlug = lists[0]?.slug || "neetcode-150";

  // Global progress from the user's status map vs the full catalog size.
  const totalSolved = Object.values(statusMap).filter((s) => s === "solved").length;
  const totalAttempted = Object.values(statusMap).filter((s) => s === "attempted").length;
  const catalogTotal = catalogCount || topics.reduce((acc, t) => acc + t.count, 0) || 0;

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

  const getDiffBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/20";
      case "medium":
        return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/20";
      case "hard":
        return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/20";
      default:
        return "text-white/60 bg-white/10 border-white/15";
    }
  };

  return (
    <div className="space-y-10 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Developer Squad
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Arena
          </h1>
        </div>

        {/* Currently Active User Status Pill */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] self-start md:self-auto shadow-sm backdrop-blur-xl">
          <div className="w-6 h-6 rounded-full bg-[#fa586a]/20 flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden border border-[#fa586a]/30">
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
            <span className="font-semibold text-white truncate max-w-[140px]">@{currentDisplayName}</span>
            <span className="text-white/40 text-[11px]">online</span>
          </div>
        </div>
      </div>

      {/* ── 1. APPLE MUSIC EDITORIAL SPOTLIGHT (TOP PICKS) ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Top Picks for Squad
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Daily problem spotlight, active streak flame, and standings.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider font-mono">
            Editorial
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ── Hero Card: Problem of the Day (Spans 2 columns on desktop) ── */}
          {potd ? (
            <div
              className={cn(
                "relative col-span-1 md:col-span-2 min-h-[260px] rounded-3xl p-6 overflow-hidden apple-card-crimson flex flex-col justify-between group cursor-pointer transition-all hover:scale-[1.01]"
              )}
              onClick={handleStartPotd}
            >
              {/* Background Geometric Watermark */}
              <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
                <DPPattern />
              </div>

              {/* Card Header Eyebrow */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fa586a] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fa586a]" />
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#fa586a]">
                    Featured Daily Problem
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isPotdSolved && (
                    <span className="px-2 py-0.5 rounded-full bg-[#30d158]/20 border border-[#30d158]/30 text-[#30d158] text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Solved</span>
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold text-white/60">
                    #{potd.order_index}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="relative z-10 my-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", getDiffBadge(potd.difficulty))}>
                    {potd.difficulty}
                  </span>
                  <span className="text-xs text-white/50 font-medium">
                    {potd.category}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug group-hover:text-white transition-colors">
                  {potd.title}
                </h3>
              </div>

              {/* Card Footer Actions */}
              <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartPotd}
                    className="px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isPotdSolved ? "Solve Again" : "Start Session"}</span>
                  </button>
                  <a
                    href={`https://leetcode.com/problems/${potd.title_slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white transition-all border border-white/[0.08]"
                    title="Open on LeetCode"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <span className="text-[11px] text-white/40 font-mono hidden sm:inline">
                  Dock Solver Ready
                </span>
              </div>
            </div>
          ) : (
            <div className="relative col-span-1 md:col-span-2 min-h-[260px] rounded-3xl p-6 overflow-hidden apple-card-crimson flex flex-col justify-between">
              <div className="relative z-10">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#fa586a]">
                  Featured Daily Problem
                </span>
                <h3 className="text-2xl font-black text-white mt-2">Loading Daily Challenge...</h3>
              </div>
            </div>
          )}

          {/* ── Card 2: Streak Guardian ── */}
          <Link
            href="/leaderboard"
            className="relative min-h-[260px] rounded-3xl p-6 overflow-hidden apple-card-amber flex flex-col justify-between group transition-all hover:scale-[1.01]"
          >
            <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
              <SlidingWindowPattern />
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#ff9f0a] text-[10px] font-extrabold uppercase tracking-widest">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>Squad Streak</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-mono font-bold text-white/80">
                {totalStreak > 0 ? "BURNING" : "IDLE"}
              </span>
            </div>

            <div className="relative z-10">
              <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                {totalStreak} <span className="text-base font-normal text-white/50">days</span>
              </div>
              <div className="text-xs font-semibold text-white/80 mt-1">
                Combined Squad Fire
              </div>
              <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                {streakLeader && streakLeader.streak > 0
                  ? `@${streakLeader.username} leads with ${streakLeader.streak}d flame`
                  : "Solve a problem today to spark the streak"}
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs text-[#ff9f0a] font-semibold pt-2 border-t border-white/[0.08]">
              <span>View Streak Ranks</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* ── Card 3: Contest Standings ── */}
          <Link
            href="/leaderboard"
            className="relative min-h-[260px] rounded-3xl p-6 overflow-hidden apple-card-indigo flex flex-col justify-between group transition-all hover:scale-[1.01]"
          >
            <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
              <GraphPattern />
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#bf5af2] text-[10px] font-extrabold uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5" />
                <span>Contest Arena</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-mono font-bold text-white/80">
                RATED
              </span>
            </div>

            <div className="relative z-10">
              <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                {topMember ? Math.round(topMember.contest_rating) : 1500}
              </div>
              <div className="text-xs font-semibold text-white/80 mt-1">
                Top Rating Standing
              </div>
              <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                {topMember ? `@${topMember.username} holds the crown` : "Compete in weekly LeetCode contests"}
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs text-[#bf5af2] font-semibold pt-2 border-t border-white/[0.08]">
              <span>Leaderboard Standings</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* ── Card 4: Suggestions Hub ── */}
          <Link
            href="/suggestions"
            className="relative min-h-[260px] rounded-3xl p-6 overflow-hidden apple-card-sapphire flex flex-col justify-between group transition-all hover:scale-[1.01]"
          >
            <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
              <BinarySearchPattern />
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#0a84ff] text-[10px] font-extrabold uppercase tracking-widest">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Peer Challenges</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-mono font-bold text-white/80">
                {suggestionsCount > 0 ? `${suggestionsCount} OPEN` : "CHALLENGE"}
              </span>
            </div>

            <div className="relative z-10">
              <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                {suggestionsCount}
              </div>
              <div className="text-xs font-semibold text-white/80 mt-1">
                Active Peer Challenges
              </div>
              <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                {suggestionsCount > 0
                  ? "Solve peer challenges and verify your algorithmic intuition"
                  : "Challenge your squad with tough interview questions"}
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs text-[#0a84ff] font-semibold pt-2 border-t border-white/[0.08]">
              <span>Open Suggestions</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* ── 1.5 YOUR PROGRESS (APPLE MUSIC METRIC STRIP) ── */}
      {user && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Your Progress</h2>
              <p className="text-xs text-white/40 mt-0.5">Live catalog completion and combat readiness.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDossierOpen(true)}
                className="text-xs text-white hover:text-white/90 flex items-center gap-1.5 font-bold px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-all cursor-pointer shadow-sm"
              >
                <Shield className="w-3.5 h-3.5 text-[#fa586a]" />
                <span>Warrior Dossier</span>
              </button>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="text-xs text-[#fa586a] hover:text-[#fa586a]/80 flex items-center gap-1.5 font-semibold px-3.5 py-1.5 rounded-full bg-[#fa586a]/10 border border-[#fa586a]/20 transition-all cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>
                  {profile?.leetcode_username ? "Re-sync LeetCode" : "Connect LeetCode"}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Problems Solved",
                value: totalSolved,
                total: catalogTotal,
                color: "#30d158",
                aura: "apple-card-emerald",
                icon: CheckCircle2,
              },
              {
                label: "Currently Attempting",
                value: totalAttempted,
                total: catalogTotal,
                color: "#ff9f0a",
                aura: "apple-card-amber",
                icon: Sparkles,
              },
              {
                label: "Total Problem Catalog",
                value: catalogTotal,
                total: catalogTotal,
                color: "#fa586a",
                aura: "apple-card-crimson",
                icon: Trophy,
              },
            ].map((stat) => {
              const pct = stat.total > 0 ? Math.round((stat.value / stat.total) * 100) : 0;
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className={cn(
                    "relative h-32 rounded-3xl p-5 overflow-hidden flex flex-col justify-between transition-all",
                    stat.aura
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                      {stat.label}
                    </span>
                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>

                  <div>
                    <div className="text-3xl font-black text-white font-mono leading-none">
                      {stat.value.toLocaleString()}
                    </div>
                    {stat.label !== "Total Problem Catalog" && (
                      <div className="text-[11px] text-white/40 mt-1 font-mono">
                        {pct}% of catalog completed
                      </div>
                    )}
                  </div>

                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: stat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 2. BROWSE DSA TOPICS (APPLE MUSIC CATEGORY GRID) ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Browse Topics
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {catalogTotal > 0
                ? `${catalogTotal.toLocaleString()} problems organized across ${topics.length} DSA patterns`
                : "Structured patterns backed by roadmaps"}
            </p>
          </div>
          {topics.length > 24 && (
            <button
              onClick={() => setShowAllTopics((v) => !v)}
              className="text-xs text-[#fa586a] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span>{showAllTopics ? "Show Less" : `Show All (${topics.length})`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(showAllTopics ? topics : topics.slice(0, 24)).map((t, idx) => {
            const PatternComponent = PATTERNS[idx % PATTERNS.length];
            const surfaceClass = TOPIC_SURFACES[idx % TOPIC_SURFACES.length];
            const solvedPct = t.count > 0 ? (t.solved / t.count) * 100 : 0;
            const attemptedPct = t.count > 0 ? (t.attempted / t.count) * 100 : 0;

            return (
              <Link
                key={t.topic}
                href={`/sheets/${primaryListSlug}?topic=${encodeURIComponent(t.topic)}`}
                className={cn(
                  "relative aspect-[16/10] rounded-2xl p-4 overflow-hidden group hover:scale-[1.02] transition-all flex flex-col justify-between",
                  surfaceClass
                )}
              >
                {/* Vector pattern watermark */}
                <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
                  <PatternComponent />
                </div>

                <div className="relative z-10 flex justify-between items-start">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/10 font-mono">
                    {t.count} {t.count === 1 ? "Problem" : "Problems"}
                  </span>
                  {user && (t.solved > 0 || t.attempted > 0) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#30d158]/20 backdrop-blur-md text-[10px] font-bold text-[#30d158] border border-[#30d158]/30 font-mono">
                      {t.solved}/{t.count} ✓
                    </span>
                  )}
                </div>

                <div className="relative z-10">
                  <h3 className="text-sm md:text-base font-bold text-white leading-tight drop-shadow-sm tracking-tight group-hover:text-white transition-colors">
                    {t.topic}
                  </h3>
                  {user && t.count > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
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

      {/* User Stats Holographic Dossier Modal */}
      <UserStatsDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        profile={profile}
        statusMap={statusMap}
      />

      {/* Connect LeetCode Modal */}
      <ConnectLeetCodeModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={() => {
          refreshProfile();
        }}
      />
    </div>
  );
}
