"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_PROBLEMS = [
  { id: "1", title: "Two Sum", slug: "two-sum", difficulty: "Easy", category: "Arrays & Hashing" },
  { id: "15", title: "3Sum", slug: "3sum", difficulty: "Medium", category: "Two Pointers" },
  { id: "42", title: "Trapping Rain Water", slug: "trapping-rain-water", difficulty: "Hard", category: "Monotonic Stack" },
  { id: "70", title: "Climbing Stairs", slug: "climbing-stairs", difficulty: "Easy", category: "Dynamic Programming" },
  { id: "128", title: "Longest Consecutive Sequence", slug: "longest-consecutive-sequence", difficulty: "Medium", category: "Arrays & Hashing" },
  { id: "200", title: "Number of Islands", slug: "number-of-islands", difficulty: "Medium", category: "Graphs" },
  { id: "300", title: "Longest Increasing Subsequence", slug: "longest-increasing-subsequence", difficulty: "Medium", category: "Dynamic Programming" },
  { id: "76", title: "Minimum Window Substring", slug: "minimum-window-substring", difficulty: "Hard", category: "Sliding Window" },
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = SAMPLE_PROBLEMS.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.id.includes(query)
  );

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
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

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 px-4 select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden z-10 animate-in fade-in zoom-in-95">
        {/* Search Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#fa586a] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems, topics, #number (e.g. Two Sum, DP, 15)..."
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white rounded-lg transition-colors"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-white/[0.04]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-xs">
              No matching problems found. Try searching by problem title, category, or number.
            </div>
          ) : (
            filtered.map((problem) => (
              <div
                key={problem.id}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.04] transition-colors group cursor-pointer"
                onClick={() => {
                  window.open(`https://leetcode.com/problems/${problem.slug}/`, "_blank");
                  onClose();
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center font-mono text-xs text-white/40 font-bold group-hover:border-[#fa586a]/40 group-hover:text-white transition-colors">
                    #{problem.id}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white group-hover:text-[#fa586a] transition-colors">
                        {problem.title}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          getDifficultyBadge(problem.difficulty)
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/35 mt-0.5">
                      {problem.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-white/35 group-hover:text-white transition-colors">
                  <span className="text-[10px] hidden sm:inline">Solve on LeetCode</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/30">
          <div className="flex items-center gap-2">
            <span>Quick Select:</span>
            <kbd className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.06] font-mono text-[10px]">
              ↑↓
            </kbd>
            <span>navigate</span>
            <kbd className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.06] font-mono text-[10px]">
              ↵
            </kbd>
            <span>open</span>
          </div>
          <div className="text-[#fa586a] font-semibold text-[11px] tracking-wide">
            Mahayuddh Index
          </div>
        </div>
      </div>
    </div>
  );
}
