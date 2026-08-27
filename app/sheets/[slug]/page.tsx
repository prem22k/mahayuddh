"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ExternalLink,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getListWithProblems, getSquadProblemStatuses, toggleProblemStatus } from "@/lib/data/sheets";
import { useAuth } from "@/components/providers/AuthProvider";
import { CustomList, ListProblem, UserProblemStatus } from "@/types/database";

export default function SheetPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "neetcode-150";

  const [list, setList] = useState<CustomList | null>(null);
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadSheetData() {
      setLoading(true);
      try {
        const { list: listData, problems: problemsData } = await getListWithProblems(slug);
        setList(listData);
        setProblems(problemsData);

        if (problemsData.length > 0) {
          const slugs = problemsData.map((p) => p.title_slug);
          const squadStatuses: UserProblemStatus[] = await getSquadProblemStatuses(slugs);
          const statusMap: Record<string, boolean> = {};
          for (const s of squadStatuses) {
            statusMap[s.problem_slug] = s.status === "solved";
          }
          setStatuses(statusMap);
        }
      } catch (err) {
        console.error("Error loading sheet:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSheetData();
  }, [slug]);

  const { user } = useAuth();

  const handleToggle = async (problemSlug: string) => {
    if (!user) return;
    const nextVal = !statuses[problemSlug];
    setStatuses((prev) => ({ ...prev, [problemSlug]: nextVal }));
    await toggleProblemStatus(user.id, problemSlug, nextVal);
  };

  const categories = ["All", ...Array.from(new Set(problems.map((p) => p.category)))];

  const filteredProblems = problems.filter((problem) => {
    const matchesCat = selectedCategory === "All" || problem.category === selectedCategory;
    const matchesSearch =
      problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.title_slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-apple-green bg-apple-green/10 border-apple-green/30";
      case "medium":
        return "text-apple-orange bg-apple-orange/10 border-apple-orange/30";
      case "hard":
        return "text-apple-red bg-apple-red/10 border-apple-red/30";
      default:
        return "text-txt-secondary";
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-txt-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-apple-accent" />
        <span className="text-xs">Loading roadmap from Supabase...</span>
      </div>
    );
  }

  const title = list?.title || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-apple-accent tracking-wider uppercase mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{list?.emoji || "📚"} Interactive Roadmap ({problems.length} Questions)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            {list?.description || "Master core algorithmic problem patterns with real-time tracking"}
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-txt-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problems..."
              className="pl-9 pr-3 py-1.5 bg-surface-sidebar border border-border-subtle rounded-pill text-xs text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-apple-accent w-48"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "px-3.5 py-1.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-all border",
              selectedCategory === category
                ? "bg-apple-accent text-white border-apple-accent shadow-sm"
                : "bg-surface-sidebar text-txt-secondary hover:text-txt-primary border-border-subtle hover:bg-surface-raised"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-sidebar border border-border-subtle rounded-2xl overflow-hidden shadow-subtle">
        <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-border-subtle text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider items-center">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 md:col-span-5">Problem</div>
          <div className="col-span-3 hidden md:block">Category</div>
          <div className="col-span-3 md:col-span-2 text-center font-bold text-txt-primary">Solved Status</div>
          <div className="col-span-2 md:col-span-1 text-right">LeetCode</div>
        </div>

        <div className="divide-y divide-border-subtle">
          {filteredProblems.length === 0 ? (
            <div className="p-8 text-center text-txt-secondary text-xs">
              No problems found in this category.
            </div>
          ) : (
            filteredProblems.map((problem, idx) => {
              const isSolved = !!statuses[problem.title_slug];
              return (
                <div
                  key={problem.id}
                  className="grid grid-cols-12 gap-3 px-6 py-3.5 items-center hover:bg-surface-raised transition-colors group text-xs"
                >
                  <div className="col-span-1 text-center font-mono text-[11px] text-txt-secondary font-bold">
                    {idx + 1}
                  </div>

                  <div className="col-span-6 md:col-span-5 flex items-center gap-2.5 truncate">
                    <span className="font-semibold text-txt-primary truncate group-hover:text-apple-accent transition-colors">
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

                  <div className="col-span-3 hidden md:block text-[11px] text-txt-secondary truncate">
                    {problem.category}
                  </div>

                  <div className="col-span-3 md:col-span-2 flex justify-center">
                    <button
                      onClick={() => handleToggle(problem.title_slug)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11px] font-semibold border transition-all",
                        isSolved
                          ? "bg-apple-green/15 text-apple-green border-apple-green/30"
                          : "bg-surface-muted text-txt-secondary border-border-subtle hover:text-txt-primary hover:border-border-strong"
                      )}
                    >
                      {isSolved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Solved</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5 opacity-40" />
                          <span>Mark Done</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <a
                      href={`https://leetcode.com/problems/${problem.title_slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-txt-secondary hover:text-txt-primary hover:bg-surface-strong transition-colors"
                      aria-label={`Solve ${problem.title} on LeetCode`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
