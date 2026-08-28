"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Search,
  Play,
  CheckCircle2,
  Clock,
  Circle,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSheetWithCatalog,
  setProblemStatus,
  batchSetProblemStatuses,
} from "@/lib/data/sheets";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { ProblemStatusCell } from "@/components/matrix/ProblemStatusCell";
import { CustomList, ListProblem, Problem, TriState } from "@/types/database";
import confetti from "canvas-confetti";

function SheetContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = (params?.slug as string) || "neetcode-150";
  const initialCat = searchParams.get("category");
  const initialTopic = searchParams.get("topic");

  const [list, setList] = useState<CustomList | null>(null);
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [catalogBySlug, setCatalogBySlug] = useState<Map<string, Problem>>(new Map());
  const [statuses, setStatuses] = useState<Record<string, TriState>>({});
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<"all" | "solved" | "attempted" | "todo">("all");
  const [selectedCategory, setSelectedCategory] = useState(initialCat || "All");
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const { user } = useAuth();
  const { activeProblem, startSolving } = useSolving();

  useEffect(() => {
    if (initialCat) setSelectedCategory(initialCat);
    if (initialTopic) setSelectedTopic(initialTopic);
  }, [initialCat, initialTopic]);

  useEffect(() => {
    async function loadSheetData() {
      setLoading(true);
      try {
        const result = await getSheetWithCatalog(slug, user?.id);
        setList(result.list);
        setProblems(result.problems);
        setCatalogBySlug(result.catalogBySlug);
        setStatuses(result.statusMap);
      } catch (err) {
        console.error("Error loading sheet:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSheetData();
  }, [slug, user?.id]);

  // Refresh status when the dock (or another tab) marks a problem done.
  useEffect(() => {
    const onStatusChanged = (e: Event) => {
      const { slug: changedSlug, status } = (e as CustomEvent).detail ?? {};
      if (changedSlug) {
        setStatuses((prev) => ({ ...prev, [changedSlug]: (status as TriState) || "solved" }));
      }
    };
    window.addEventListener("problem-status-changed", onStatusChanged);
    return () => window.removeEventListener("problem-status-changed", onStatusChanged);
  }, []);

  const handleToggle = async (problemSlug: string, next: TriState) => {
    // Optimistic UI update
    setStatuses((prev) => ({ ...prev, [problemSlug]: next }));
    if (!user) return;
    await setProblemStatus(user.id, problemSlug, next);
  };

  const handleBatchToggleTopic = async (categoryName: string, next: TriState) => {
    const categoryProblems = problems.filter((p) => p.category === categoryName);
    const slugs = categoryProblems.map((p) => p.title_slug);

    const newStatuses = { ...statuses };
    slugs.forEach((slug) => {
      newStatuses[slug] = next;
    });
    setStatuses(newStatuses);

    if (next === "solved") {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#30d158", "#ffffff", "#ffd60a"],
      });
    }

    if (!user) return;
    await batchSetProblemStatuses(user.id, slugs, next);
  };

  const handleStartSolving = (p: ListProblem) => {
    startSolving({
      id: p.order_index,
      title: p.title,
      slug: p.title_slug,
      difficulty: p.difficulty,
      category: p.category,
    });
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const topicSet = (slug: string): string[] =>
    catalogBySlug.get(slug)?.topics ?? [];

  // Metrics computation across entire sheet
  const totalCount = problems.length;
  const solvedCount = problems.filter((p) => statuses[p.title_slug] === "solved").length;
  const attemptedCount = problems.filter((p) => statuses[p.title_slug] === "attempted").length;
  const todoCount = totalCount - solvedCount - attemptedCount;
  const percentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  // Breakdown by difficulty
  const easyProblems = problems.filter((p) => p.difficulty === "Easy");
  const mediumProblems = problems.filter((p) => p.difficulty === "Medium");
  const hardProblems = problems.filter((p) => p.difficulty === "Hard");

  const easySolved = easyProblems.filter((p) => statuses[p.title_slug] === "solved").length;
  const mediumSolved = mediumProblems.filter((p) => statuses[p.title_slug] === "solved").length;
  const hardSolved = hardProblems.filter((p) => statuses[p.title_slug] === "solved").length;

  // Filtered problems
  const filteredProblems = problems.filter((problem) => {
    const status = statuses[problem.title_slug] || "unsolved";
    if (statusFilter === "solved" && status !== "solved") return false;
    if (statusFilter === "attempted" && status !== "attempted") return false;
    if (statusFilter === "todo" && status !== "unsolved") return false;

    const matchesCat =
      selectedCategory === "All" ||
      problem.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      selectedCategory.toLowerCase().includes(problem.category.toLowerCase());

    const matchesTopic =
      !selectedTopic ||
      topicSet(problem.title_slug).some((t) => t.toLowerCase() === selectedTopic.toLowerCase());

    const matchesSearch =
      problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.title_slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.order_index.toString().includes(searchQuery);

    return matchesCat && matchesTopic && matchesSearch;
  });

  const categories = ["All", ...Array.from(new Set(problems.map((p) => p.category)))];

  // Group filtered problems by category
  const problemsByCategory = categories
    .filter((c) => c !== "All")
    .map((cat) => ({
      category: cat,
      problems: filteredProblems.filter((p) => p.category === cat),
    }))
    .filter((group) => group.problems.length > 0);

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/25";
      case "medium":
        return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/25";
      case "hard":
        return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/25";
      default:
        return "text-white/40";
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-white/40">
        <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
        <span className="text-xs font-medium tracking-wide">Loading roadmap...</span>
      </div>
    );
  }

  const title = list?.title || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="space-y-8 select-none">
      {/* ── Header & Title ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Roadmap Matrix • {totalCount} Problems
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-white/40 mt-1">
            {list?.description || "Master core algorithmic problem patterns with real-time interactive tracking."}
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problems or patterns..."
              className="pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 w-60 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Master Interactive Progress Banner ── */}
      <div className="p-6 rounded-3xl bg-[#1c1c1e]/70 border border-white/[0.08] backdrop-blur-xl shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
              Overall Roadmap Mastery
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-white">{percentage}%</span>
              <span className="text-xs text-white/40">
                ({solvedCount} / {totalCount} Solved)
              </span>
            </div>
          </div>

          {/* Difficulty Counters */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-[#30d158]/10 border border-[#30d158]/20 flex items-center gap-1.5 text-[#30d158]">
              <span className="font-bold">Easy</span>
              <span className="font-mono text-white/70">{easySolved}/{easyProblems.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#ff9f0a]/10 border border-[#ff9f0a]/20 flex items-center gap-1.5 text-[#ff9f0a]">
              <span className="font-bold">Medium</span>
              <span className="font-mono text-white/70">{mediumSolved}/{mediumProblems.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#ff453a]/10 border border-[#ff453a]/20 flex items-center gap-1.5 text-[#ff453a]">
              <span className="font-bold">Hard</span>
              <span className="font-mono text-white/70">{hardSolved}/{hardProblems.length}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden p-0.5 border border-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#fa586a] via-[#ffd60a] to-[#30d158] transition-all duration-500 shadow-[0_0_12px_rgba(48,209,88,0.5)]"
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
      </div>

      {/* ── Status Filter Pills & Topic Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
              statusFilter === "all"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter("solved")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "solved"
                ? "bg-[#30d158]/20 text-[#30d158] border border-[#30d158]/30 shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Solved ({solvedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter("attempted")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "attempted"
                ? "bg-[#ff9f0a]/20 text-[#ff9f0a] border border-[#ff9f0a]/30 shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            <Clock className="w-3 h-3" />
            <span>Attempting ({attemptedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter("todo")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "todo"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            <Circle className="w-3 h-3" />
            <span>Todo ({todoCount})</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.slice(0, 5).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer",
                selectedCategory === category
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "bg-white/[0.03] text-white/40 hover:text-white/80 border border-white/[0.06]"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* ── Problem Groupings & Matrix Table ── */}
      <div className="space-y-6">
        {problemsByCategory.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-xs bg-[#1c1c1e]/60 rounded-2xl border border-white/[0.06]">
            No problems match your selected filters.
          </div>
        ) : (
          problemsByCategory.map((group) => {
            const isCollapsed = Boolean(collapsedCategories[group.category]);
            const groupSolved = group.problems.filter((p) => statuses[p.title_slug] === "solved").length;
            const groupTotal = group.problems.length;
            const groupProgress = Math.round((groupSolved / groupTotal) * 100);

            return (
              <div
                key={group.category}
                className="bg-[#1c1c1e]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-subtle backdrop-blur-xl transition-all"
              >
                {/* Topic Header & Batch Actions */}
                <div
                  onClick={() => toggleCategoryCollapse(group.category)}
                  className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-white/40 hover:text-white transition-colors">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                    <h3 className="text-sm md:text-base font-bold text-white tracking-tight">
                      {group.category}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-bold text-white/60">
                      {groupSolved} / {groupTotal} ({groupProgress}%)
                    </span>
                  </div>

                  {/* Batch Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleBatchToggleTopic(group.category, "solved")}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-[#30d158]/15 hover:text-[#30d158] hover:border-[#30d158]/30 border border-white/[0.06] text-[10px] font-bold text-white/50 transition-all flex items-center gap-1 cursor-pointer"
                      title="Mark all problems in this section as Solved"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">Mark Solved</span>
                    </button>
                    <button
                      onClick={() => handleBatchToggleTopic(group.category, "unsolved")}
                      className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-bold text-white/40 hover:text-white/70 transition-all flex items-center gap-1 cursor-pointer"
                      title="Reset section to Todo"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  </div>
                </div>

                {/* Problems List Table */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/[0.04]">
                    {group.problems.map((problem, idx) => {
                      const currentStatus = statuses[problem.title_slug] || "unsolved";
                      const isCurrentActive = activeProblem?.slug === problem.title_slug;

                      return (
                        <div
                          key={problem.id}
                          className={cn(
                            "grid grid-cols-12 gap-3 px-6 py-3.5 items-center hover:bg-white/[0.03] transition-colors group text-xs",
                            isCurrentActive && "bg-[#fa586a]/10"
                          )}
                        >
                          {/* 1-Click Interactive Tri-State Status Checkbox */}
                          <div className="col-span-1 flex items-center justify-center">
                            <ProblemStatusCell
                              status={currentStatus}
                              onToggle={(next) => handleToggle(problem.title_slug, next)}
                              size="md"
                            />
                          </div>

                          {/* Problem Title & Number */}
                          <div
                            onClick={() => handleStartSolving(problem)}
                            className="col-span-7 md:col-span-8 flex items-center gap-3 truncate cursor-pointer"
                          >
                            <span className="font-mono text-[11px] text-white/30 shrink-0">
                              {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                            </span>
                            <span
                              className={cn(
                                "font-semibold truncate transition-colors text-sm",
                                isCurrentActive
                                  ? "text-[#fa586a]"
                                  : currentStatus === "solved"
                                  ? "text-white/80"
                                  : "text-white group-hover:text-[#fa586a]"
                              )}
                            >
                              {problem.title}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                                getDifficultyBadge(problem.difficulty)
                              )}
                            >
                              {problem.difficulty}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="col-span-4 md:col-span-3 flex items-center justify-end gap-2">
                            {/* Solve in Player Dock */}
                            <button
                              onClick={() => handleStartSolving(problem)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                                isCurrentActive
                                  ? "bg-[#fa586a] text-white shadow-glow"
                                  : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                              )}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span className="hidden sm:inline">
                                {isCurrentActive ? "Solving" : "Solve"}
                              </span>
                            </button>

                            {/* LeetCode Link */}
                            <a
                              href={`https://leetcode.com/problems/${problem.title_slug}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                              title={`Open ${problem.title} on LeetCode`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SheetPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-white/40">
          <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
          <span className="text-xs font-medium tracking-wide">Loading roadmap...</span>
        </div>
      }
    >
      <SheetContent />
    </Suspense>
  );
}
