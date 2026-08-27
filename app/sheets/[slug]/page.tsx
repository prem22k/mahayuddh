"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ExternalLink,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProblemRow {
  id: string;
  number: string;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  squadStatus: {
    prem: boolean;
    rahul: boolean;
    arjun: boolean;
    sneha: boolean;
  };
}

const SAMPLE_SHEET_PROBLEMS: ProblemRow[] = [
  {
    id: "1",
    number: "217",
    title: "Contains Duplicate",
    slug: "contains-duplicate",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    squadStatus: { prem: true, rahul: true, arjun: true, sneha: true },
  },
  {
    id: "2",
    number: "242",
    title: "Valid Anagram",
    slug: "valid-anagram",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    squadStatus: { prem: true, rahul: true, arjun: true, sneha: false },
  },
  {
    id: "3",
    number: "1",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    squadStatus: { prem: true, rahul: true, arjun: true, sneha: true },
  },
  {
    id: "4",
    number: "49",
    title: "Group Anagrams",
    slug: "group-anagrams",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    squadStatus: { prem: true, rahul: true, arjun: false, sneha: false },
  },
  {
    id: "5",
    number: "347",
    title: "Top K Frequent Elements",
    slug: "top-k-frequent-elements",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    squadStatus: { prem: true, rahul: false, arjun: false, sneha: false },
  },
  {
    id: "6",
    number: "128",
    title: "Longest Consecutive Sequence",
    slug: "longest-consecutive-sequence",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    squadStatus: { prem: true, rahul: true, arjun: true, sneha: false },
  },
  {
    id: "7",
    number: "15",
    title: "3Sum",
    slug: "3sum",
    difficulty: "Medium",
    category: "Two Pointers",
    squadStatus: { prem: true, rahul: true, arjun: true, sneha: false },
  },
  {
    id: "8",
    number: "11",
    title: "Container With Most Water",
    slug: "container-with-most-water",
    difficulty: "Medium",
    category: "Two Pointers",
    squadStatus: { prem: true, rahul: true, arjun: false, sneha: false },
  },
  {
    id: "9",
    number: "42",
    title: "Trapping Rain Water",
    slug: "trapping-rain-water",
    difficulty: "Hard",
    category: "Two Pointers",
    squadStatus: { prem: true, rahul: false, arjun: false, sneha: false },
  },
  {
    id: "10",
    number: "300",
    title: "Longest Increasing Subsequence",
    slug: "longest-increasing-subsequence",
    difficulty: "Medium",
    category: "Dynamic Programming",
    squadStatus: { prem: true, rahul: true, arjun: false, sneha: false },
  },
];

const CATEGORIES = ["All", "Arrays & Hashing", "Two Pointers", "Dynamic Programming"];

export default function SheetPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const sheetTitle = slug
    ? slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "Roadmap Sheet";

  const filteredProblems = SAMPLE_SHEET_PROBLEMS.filter((problem) => {
    const matchesCat = selectedCategory === "All" || problem.category === selectedCategory;
    const matchesSearch =
      problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.number.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-apple-accent tracking-wider uppercase mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Interactive Roadmap & Squad Matrix</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            {sheetTitle}
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            Track squad progress across core algorithmic patterns
          </p>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-3">
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

      {/* Category Pills Bar (Apple Music Filter Style) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((category) => (
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

      {/* Squad Matrix Table */}
      <div className="bg-surface-sidebar border border-border-subtle rounded-2xl overflow-hidden shadow-subtle">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-border-subtle text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider items-center">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4 md:col-span-4">Problem</div>
          <div className="col-span-2 hidden md:block">Category</div>
          {/* Squad Columns */}
          <div className="col-span-1 text-center font-bold text-txt-primary">Prem</div>
          <div className="col-span-1 text-center font-bold text-txt-primary">Rahul</div>
          <div className="col-span-1 text-center font-bold text-txt-primary">Arjun</div>
          <div className="col-span-1 text-center font-bold text-txt-primary">Sneha</div>
          <div className="col-span-1 text-right">Link</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border-subtle">
          {filteredProblems.map((problem) => (
            <div
              key={problem.id}
              className="grid grid-cols-12 gap-3 px-6 py-3.5 items-center hover:bg-surface-raised transition-colors group text-xs"
            >
              {/* Problem Number */}
              <div className="col-span-1 text-center font-mono text-[11px] text-txt-secondary font-bold">
                {problem.number}
              </div>

              {/* Title & Difficulty */}
              <div className="col-span-4 md:col-span-4 flex items-center gap-2.5 truncate">
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

              {/* Category */}
              <div className="col-span-2 hidden md:block text-[11px] text-txt-secondary truncate">
                {problem.category}
              </div>

              {/* Squad Completion Status (Prem) */}
              <div className="col-span-1 flex justify-center">
                {problem.squadStatus.prem ? (
                  <CheckCircle2 className="w-4 h-4 text-apple-green" />
                ) : (
                  <Circle className="w-4 h-4 text-txt-tertiary opacity-40" />
                )}
              </div>

              {/* Squad Completion Status (Rahul) */}
              <div className="col-span-1 flex justify-center">
                {problem.squadStatus.rahul ? (
                  <CheckCircle2 className="w-4 h-4 text-apple-green" />
                ) : (
                  <Circle className="w-4 h-4 text-txt-tertiary opacity-40" />
                )}
              </div>

              {/* Squad Completion Status (Arjun) */}
              <div className="col-span-1 flex justify-center">
                {problem.squadStatus.arjun ? (
                  <CheckCircle2 className="w-4 h-4 text-apple-green" />
                ) : (
                  <Circle className="w-4 h-4 text-txt-tertiary opacity-40" />
                )}
              </div>

              {/* Squad Completion Status (Sneha) */}
              <div className="col-span-1 flex justify-center">
                {problem.squadStatus.sneha ? (
                  <CheckCircle2 className="w-4 h-4 text-apple-green" />
                ) : (
                  <Circle className="w-4 h-4 text-txt-tertiary opacity-40" />
                )}
              </div>

              {/* External LeetCode Link */}
              <div className="col-span-1 flex justify-end">
                <a
                  href={`https://leetcode.com/problems/${problem.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-txt-secondary hover:text-txt-primary hover:bg-surface-strong transition-colors"
                  aria-label={`Solve ${problem.title} on LeetCode`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
