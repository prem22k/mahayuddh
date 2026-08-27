"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, ExternalLink, Flame, BookOpen } from "lucide-react";
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
        else {
          // Open handled by parent or state
        }
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-surface-muted border border-border-strong rounded-2xl shadow-modal overflow-hidden z-10 animate-in fade-in zoom-in-95">
        {/* Search Header */}
        <div className="p-4 border-b border-border-subtle flex items-center gap-3">
          <Search className="w-5 h-5 text-apple-accent shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems, topics, #number (e.g., 'Two Sum', 'DP', '15')..."
            className="w-full bg-transparent text-sm text-txt-primary placeholder:text-txt-tertiary focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-txt-secondary hover:text-txt-primary rounded-lg transition-colors"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border-subtle/40">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-txt-secondary text-xs">
              No matching problems found. Try searching by number or topic.
            </div>
          ) : (
            filtered.map((problem) => (
              <div
                key={problem.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-raised transition-colors group cursor-pointer"
                onClick={() => {
                  window.open(`https://leetcode.com/problems/${problem.slug}/`, "_blank");
                  onClose();
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center font-mono text-xs text-txt-secondary font-bold group-hover:border-apple-accent/50 group-hover:text-txt-primary transition-colors">
                    {problem.id}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-txt-primary group-hover:text-apple-accent transition-colors">
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
                    <span className="text-[11px] text-txt-secondary flex items-center gap-1.5 mt-0.5">
                      <BookOpen className="w-3 h-3 text-txt-tertiary" />
                      {problem.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-txt-secondary group-hover:text-txt-primary">
                  <span className="text-[10px] hidden sm:inline">Solve on LeetCode</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-surface-sidebar/90 border-t border-border-subtle flex items-center justify-between text-[11px] text-txt-secondary">
          <div className="flex items-center gap-2">
            <span>Quick Select:</span>
            <kbd className="px-1.5 py-0.5 bg-surface-muted rounded border border-border-subtle font-mono text-[10px]">
              ↑↓
            </kbd>
            <span>to navigate</span>
            <kbd className="px-1.5 py-0.5 bg-surface-muted rounded border border-border-subtle font-mono text-[10px]">
              ↵
            </kbd>
            <span>to open</span>
          </div>
          <div className="flex items-center gap-1 text-apple-accent font-semibold">
            <Flame className="w-3 h-3 fill-apple-accent" />
            <span>Mahayuddh Quick Index</span>
          </div>
        </div>
      </div>
    </div>
  );
}
