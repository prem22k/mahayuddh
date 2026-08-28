"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllProblems } from "@/lib/data/sheets";
import { searchCatalogProblems } from "@/lib/data/problems";
import { ListProblem, Problem } from "@/types/database";
import { useSolving } from "@/components/providers/SolvingProvider";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [catalogResults, setCatalogResults] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { startSolving } = useSolving();

  useEffect(() => {
    async function loadAll() {
      if (isOpen && problems.length === 0) {
        setLoading(true);
        try {
          const data = await getAllProblems();
          setProblems(data);
        } catch (e) {
          console.error("Error loading search index:", e);
        } finally {
          setLoading(false);
        }
      }
    }
    loadAll();
  }, [isOpen, problems.length]);

  useEffect(() => {
    if (!query.trim()) {
      setCatalogResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const results = await searchCatalogProblems(query.trim(), 40);
        setCatalogResults(results);
      } catch (e) {
        console.error("Catalog search error:", e);
      }
    }, 150);

    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      setCatalogResults([]);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    return problems.filter(
      (p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.title_slug.toLowerCase().includes(query.toLowerCase()) ||
        p.order_index.toString().includes(query)
    );
  }, [problems, query]);

  const combined = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string | number;
        title: string;
        title_slug: string;
        difficulty: string;
        category: string;
        order_index: number;
      }
    >();

    for (const p of filtered) {
      map.set(p.title_slug, {
        id: p.id,
        title: p.title,
        title_slug: p.title_slug,
        difficulty: p.difficulty,
        category: p.category,
        order_index: p.order_index,
      });
    }

    for (const c of catalogResults) {
      if (!map.has(c.title_slug)) {
        map.set(c.title_slug, {
          id: c.question_id || c.title_slug,
          title: c.title,
          title_slug: c.title_slug,
          difficulty: c.difficulty,
          category: c.topics?.[0] || "General",
          order_index: parseInt(c.question_id, 10) || 0,
        });
      }
    }

    return Array.from(map.values());
  }, [filtered, catalogResults]);

  if (!isOpen) return null;

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

  const handleSelectProblem = (p: {
    id: string | number;
    title: string;
    title_slug: string;
    difficulty: string;
    category: string;
    order_index: number;
  }) => {
    startSolving({
      id: p.order_index,
      title: p.title,
      slug: p.title_slug,
      difficulty: p.difficulty,
      category: p.category,
    });
    onClose();
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
            placeholder="Search all 4,000+ problems, topics, #number (e.g. Two Sum, DP, 15)..."
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-white/[0.04]">
          {loading ? (
            <div className="p-8 text-center text-white/40 text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/20 border-t-[#fa586a]" />
              <span>Indexing database problems...</span>
            </div>
          ) : combined.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-xs">
              {query ? "No matching problems found in catalog." : "Type a title, topic, or question number..."}
            </div>
          ) : (
            combined.slice(0, 50).map((problem) => (
              <div
                key={problem.title_slug}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.04] transition-colors group cursor-pointer"
                onClick={() => handleSelectProblem(problem)}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center font-mono text-xs text-white/40 font-bold group-hover:border-[#fa586a]/40 group-hover:text-white transition-colors shrink-0">
                    {problem.order_index > 0 ? problem.order_index : "#"}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-xs text-white group-hover:text-[#fa586a] transition-colors truncate">
                      {problem.title}
                    </div>
                    <div className="text-[10px] text-white/40 truncate">
                      {problem.category}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      getDifficultyBadge(problem.difficulty)
                    )}
                  >
                    {problem.difficulty}
                  </span>
                  <a
                    href={`https://leetcode.com/problems/${problem.title_slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-white/20 hover:text-white rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/30">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.06] font-mono text-[10px]">
              Esc
            </kbd>
            <span>to exit</span>
          </div>
          <div className="text-[#fa586a] font-semibold text-[11px] tracking-wide">
            {problems.length > 0 ? `${problems.length} Curated Sheets • 4,000+ Catalog Indexed` : "4,000+ Catalog Indexed"}
          </div>
        </div>
      </div>
    </div>
  );
}
