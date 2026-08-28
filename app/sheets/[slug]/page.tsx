"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ExternalLink,
  Search,
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
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Roadmap • {problems.length} Problems
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-white/40 mt-1">
            {list?.description || "Master core algorithmic problem patterns with real-time tracking"}
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in roadmap..."
              className="pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 w-52 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Category Pills (Apple Music Clean Scrolling Pills) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
              selectedCategory === category
                ? "bg-white/[0.12] text-white shadow-sm"
                : "bg-white/[0.03] text-white/40 hover:text-white/80 border border-white/[0.06] hover:bg-white/[0.06]"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* ── Problem List Table ── */}
      <div className="bg-[#1c1c1e]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-subtle backdrop-blur-xl">
        <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-white/[0.06] text-[11px] font-semibold text-white/30 uppercase tracking-wider items-center">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 md:col-span-5">Problem</div>
          <div className="col-span-3 hidden md:block">Category</div>
          <div className="col-span-3 md:col-span-2 text-center">Status</div>
          <div className="col-span-2 md:col-span-1 text-right">LeetCode</div>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {filteredProblems.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-xs">
              No problems found in this category.
            </div>
          ) : (
            filteredProblems.map((problem, idx) => {
              const isSolved = !!statuses[problem.title_slug];
              return (
                <div
                  key={problem.id}
                  className="grid grid-cols-12 gap-3 px-6 py-3 items-center hover:bg-white/[0.03] transition-colors group text-xs"
                >
                  <div className="col-span-1 text-center font-mono text-[11px] text-white/30 font-semibold">
                    {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                  </div>

                  <div className="col-span-6 md:col-span-5 flex items-center gap-2.5 truncate">
                    <span className="font-semibold text-white truncate group-hover:text-[#fa586a] transition-colors">
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

                  <div className="col-span-3 hidden md:block text-[11px] text-white/40 truncate">
                    {problem.category}
                  </div>

                  <div className="col-span-3 md:col-span-2 flex justify-center">
                    <button
                      onClick={() => handleToggle(problem.title_slug)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer",
                        isSolved
                          ? "bg-[#30d158]/15 text-[#30d158] border-[#30d158]/30"
                          : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/80 hover:border-white/[0.12]"
                      )}
                    >
                      {isSolved ? "Solved" : "Mark Done"}
                    </button>
                  </div>

                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <a
                      href={`https://leetcode.com/problems/${problem.title_slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
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
