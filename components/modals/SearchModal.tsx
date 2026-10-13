"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search } from "lucide-react";
import { getAllProblems } from "@/lib/data/sheets";
import { searchCatalogProblems } from "@/lib/data/problems";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { ModalShell } from "@/components/ui/ModalShell";
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
  const [activeIndex, setActiveIndex] = useState(0);
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
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setActiveIndex(0);
    } else {
      setQuery("");
      setCatalogResults([]);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return problems.slice(0, 3);
    return problems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.title_slug.toLowerCase().includes(q) ||
        p.order_index.toString().includes(q)
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

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, combined.slice(0, 50).length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const item = combined.slice(0, 50)[activeIndex];
      if (item) handleSelectProblem(item);
    }
  };

  const rows = combined.slice(0, 50);

  return (
    <ModalShell
      label="Search problems, patterns, people, actions"
      onClose={onClose}
      zIndexClass="z-[300]"
      maxWidthClass="max-w-[640px]"
      alignTop
      panelClassName="overflow-hidden p-0"
    >
      <div className="flex items-center gap-3 border-b border-hairline p-4">
        <Search className="h-4 w-4 shrink-0 text-text-secondary" strokeWidth={1.5} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search problems, patterns, primers, people…"
          className="w-full bg-transparent font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          aria-label="Search"
        />
        <kbd className="kbd">esc</kbd>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-2">
        <div className="px-3 pb-1 pt-2 text-xs font-medium text-text-tertiary">
          {!query ? "Recent" : "Problems"}
        </div>
        {loading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            Nothing matches &lsquo;{query}&rsquo;. Search covers problems, patterns,
            primers, and people in your squads.
          </div>
        ) : (
          rows.map((problem, i) => (
            <div
              key={problem.title_slug}
              onClick={() => handleSelectProblem(problem)}
              onMouseEnter={() => setActiveIndex(i)}
              className={
                i === activeIndex
                  ? "flex items-center justify-between rounded-lg bg-surface-overlay p-3 transition-colors"
                  : "flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-surface-raised"
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                <StatusGlyph status="none" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-primary">
                    {problem.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-xs text-text-tertiary">
                      No. {problem.order_index > 0 ? problem.order_index : "—"}
                    </span>
                    <DifficultyBadgeNew difficulty={problem.difficulty} />
                    <PatternChip label={problem.category} />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {i === activeIndex && <kbd className="kbd">⏎</kbd>}
                <ProblemLink
                  slug={problem.title_slug}
                  className="rounded-md p-1 text-text-tertiary hover:text-text-primary"
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-hairline p-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">↑↓</kbd> to move
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">⏎</kbd> to open
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">esc</kbd> to close
        </span>
      </div>
    </ModalShell>
  );
}
