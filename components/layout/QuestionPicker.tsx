"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { problemUrl } from "@/components/ui/ProblemLink";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import { ModalShell } from "@/components/ui/ModalShell";
import { useCachedQuery } from "@/lib/cache/query";
import { getAllProblems, getUserStatusesBySlugs, toStatusMap } from "@/lib/data/sheets";
import type { StatusMap } from "@/lib/statusMap";
import type { ListProblem } from "@/types/database";

const FILTERS_KEY = "mahayuddh_picker_filters";
const RANDOM_DIFF_KEY = "mahayuddh_random_difficulty";

export interface PickerFilters {
  difficulty: string;
  category: string;
}

export function loadPickerFilters(): PickerFilters {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          difficulty: typeof parsed.difficulty === "string" ? parsed.difficulty : "",
          category: typeof parsed.category === "string" ? parsed.category : "",
        };
      }
    }
  } catch {
    // ignore
  }
  return { difficulty: "", category: "" };
}

export function savePickerFilters(filters: PickerFilters): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    }
  } catch {
    // ignore
  }
}

export function loadRandomDifficulty(): string {
  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem(RANDOM_DIFF_KEY) || "";
    }
  } catch {
    // ignore
  }
  return "";
}

export function saveRandomDifficulty(val: string): void {
  try {
    if (typeof window !== "undefined") {
      if (val) localStorage.setItem(RANDOM_DIFF_KEY, val);
      else localStorage.removeItem(RANDOM_DIFF_KEY);
    }
  } catch {
    // ignore
  }
}

export interface QuestionCatalog {
  problems: ListProblem[];
  topics: string[];
  statusMap: StatusMap;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Loads problems and user statuses using the shared client cache.
 * Only fetches while idle (pass isIdle = false when a battle is running).
 */
export function useQuestionCatalog(isIdle: boolean, userId: string | null): QuestionCatalog {
  const all = useCachedQuery(isIdle ? ["all-problems"] : null, getAllProblems, {
    freshForMs: 10 * 60_000,
  });
  const statuses = useCachedQuery(
    isIdle && userId ? ["my-statuses"] : null,
    async () => toStatusMap(await getUserStatusesBySlugs(userId as string))
  );

  const statusMap = statuses.data ?? {};

  // Dedupe catalog by lowercase title_slug, keeping lowest order_index
  const problems = useMemo(() => {
    const rawProblems = all.data ?? [];
    const map = new Map<string, ListProblem>();
    for (const p of rawProblems) {
      const slug = p.title_slug.toLowerCase();
      const existing = map.get(slug);
      if (!existing || p.order_index < existing.order_index) {
        map.set(slug, p);
      }
    }
    return Array.from(map.values());
  }, [all.data]);

  // Distinct category values from the catalog, sorted A-Z
  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const p of problems) {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [problems]);

  const refresh = useCallback(() => {
    void all.refresh();
    void statuses.refresh();
  }, [all, statuses]);

  return {
    problems,
    topics,
    statusMap,
    isLoading: all.isLoading,
    error: (all.error || statuses.error) as Error | null,
    refresh,
  };
}

/**
 * Random question picker: prefer unsolved matching questions; if none unsolved, any matching.
 */
export function pickRandomProblem(
  problems: ListProblem[],
  statusMap: StatusMap,
  difficulty?: string
): ListProblem | null {
  const matching = difficulty
    ? problems.filter((p) => p.difficulty.toLowerCase() === difficulty.toLowerCase())
    : problems;

  if (matching.length === 0) return null;

  const unsolved = matching.filter(
    (p) => statusMap[p.title_slug.toLowerCase()] !== "solved"
  );
  const pool = unsolved.length > 0 ? unsolved : matching;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? null;
}

const SEGMENTS: { value: string; label: string; short: string }[] = [
  { value: "", label: "Any difficulty", short: "Any" },
  { value: "Easy", label: "Easy", short: "E" },
  { value: "Medium", label: "Medium", short: "M" },
  { value: "Hard", label: "Hard", short: "H" },
];

export function RandomDifficultySegmented({
  value,
  onChange,
  isMobile = false,
}: {
  value: string;
  onChange: (val: string) => void;
  isMobile?: boolean;
}) {
  const segments = isMobile ? SEGMENTS.filter((s) => s.value !== "") : SEGMENTS;

  const handleSelect = (val: string) => {
    if (isMobile && value === val) {
      onChange("");
    } else {
      onChange(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = segments.findIndex((s) => s.value === value);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (baseIndex + 1) % segments.length;
      onChange(segments[next].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (baseIndex - 1 + segments.length) % segments.length;
      onChange(segments[prev].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Difficulty for a random question"
      onKeyDown={handleKeyDown}
      className={cn(
        "flex h-9 items-center rounded-md border border-hairline bg-well p-0.5 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-text-primary/70 shrink-0 select-none",
        isMobile && "h-8"
      )}
    >
      {segments.map((seg) => {
        const selected = value === seg.value;
        return (
          <button
            key={seg.value || "any"}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={seg.label}
            tabIndex={selected || (!segments.some((s) => s.value === value) && seg === segments[0]) ? 0 : -1}
            onClick={() => handleSelect(seg.value)}
            className={cn(
              "flex h-full items-center justify-center rounded-[5px] font-medium transition-colors",
              isMobile ? "min-h-[28px] px-2 text-xs" : "px-3 text-sm",
              selected
                ? "bg-surface-overlay text-text-primary border border-hairline-strong shadow-xs"
                : "text-text-secondary hover:text-text-primary border border-transparent"
            )}
          >
            {isMobile ? seg.short : seg.short === "Any" ? "Any" : seg.value}
          </button>
        );
      })}
    </div>
  );
}

interface QuestionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PickerFilters;
  onFilterChange: (filters: PickerFilters) => void;
  catalog: QuestionCatalog;
  onStart: (problem: ListProblem) => void;
}

export function QuestionPicker({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  catalog,
  onStart,
}: QuestionPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Dropdown Esc / outside pointerdown closes dropdown only (not modal)
  useEffect(() => {
    if (!isDropdownOpen) return;

    const onPointer = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [isDropdownOpen]);

  // Filter and sort questions: unsolved first, then by order_index
  const filteredProblems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = catalog.problems.filter((p) => {
      if (filters.difficulty && p.difficulty.toLowerCase() !== filters.difficulty.toLowerCase()) {
        return false;
      }
      if (filters.category && p.category.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
      if (q && !p.title.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const aSolved = catalog.statusMap[a.title_slug.toLowerCase()] === "solved" ? 1 : 0;
      const bSolved = catalog.statusMap[b.title_slug.toLowerCase()] === "solved" ? 1 : 0;
      if (aSolved !== bSolved) {
        return aSolved - bSolved;
      }
      return a.order_index - b.order_index;
    });

    return list;
  }, [catalog.problems, catalog.statusMap, filters, searchQuery]);

  const displayed = useMemo(() => filteredProblems.slice(0, 100), [filteredProblems]);
  const isTruncated = filteredProblems.length > 100;

  const activeFilterCount = (filters.difficulty ? 1 : 0) + (filters.category ? 1 : 0);

  const handleClearFilters = () => {
    onFilterChange({ difficulty: "", category: "" });
    setSearchQuery("");
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      label="Choose a question"
      onClose={onClose}
      variant="sheet"
      maxWidthClass="max-w-xl"
      panelClassName="p-4 md:p-6 flex flex-col max-h-[85vh] md:max-h-[80vh] overflow-hidden"
    >
      {/* Header: Title */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <h2 className="text-base font-semibold text-text-primary">Choose a question</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search Input & Filters Button */}
      <div className="relative pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-text-tertiary" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions by title..."
              aria-label="Search questions by title"
              className="h-10 w-full rounded-md border border-hairline bg-surface-overlay pl-9 pr-8 text-sm text-text-primary placeholder:text-text-tertiary transition-colors hover:border-hairline-strong focus:border-hairline-strong focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 p-1 text-text-tertiary hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters Toggle Button */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              type="button"
              onClick={() => setIsDropdownOpen((v) => !v)}
              aria-expanded={isDropdownOpen}
              aria-label="Filters"
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
                activeFilterCount > 0
                  ? "border-hairline-strong bg-surface-overlay text-text-primary"
                  : "border-hairline bg-surface-overlay text-text-primary hover:border-hairline-strong"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-text-primary px-1 text-[11px] font-semibold text-surface">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Dropdown Popover */}
            {isDropdownOpen && (
              <div
                ref={dropdownRef}
                className="popover-panel absolute right-0 top-full mt-2 z-50 w-64 p-3.5 flex flex-col gap-3 shadow-overlay"
              >
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Difficulty
                  </label>
                  <select
                    value={filters.difficulty}
                    onChange={(e) => onFilterChange({ ...filters, difficulty: e.target.value })}
                    aria-label="Difficulty"
                    className="h-9 w-full rounded-md border border-hairline bg-surface-overlay px-2.5 text-sm text-text-primary transition-colors hover:border-hairline-strong focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-text-primary/70 scheme-dark"
                  >
                    <option value="">Any difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Topic
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
                    aria-label="Topic"
                    className="h-9 w-full rounded-md border border-hairline bg-surface-overlay px-2.5 text-sm text-text-primary transition-colors hover:border-hairline-strong focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-text-primary/70 scheme-dark"
                  >
                    <option value="">Any topic</option>
                    {catalog.topics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-hairline">
                  <button
                    type="button"
                    onClick={() => onFilterChange({ difficulty: "", category: "" })}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    Clear filters
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="rounded-md bg-surface-raised px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-overlay border border-hairline"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {filters.difficulty && (
              <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-overlay px-2 py-0.5 text-xs text-text-primary">
                <span>{filters.difficulty}</span>
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, difficulty: "" })}
                  className="p-0.5 text-text-tertiary hover:text-text-primary"
                  aria-label={`Remove difficulty ${filters.difficulty} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-overlay px-2 py-0.5 text-xs text-text-primary">
                <span className="max-w-[160px] truncate">{filters.category}</span>
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, category: "" })}
                  className="p-0.5 text-text-tertiary hover:text-text-primary"
                  aria-label={`Remove topic ${filters.category} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => onFilterChange({ difficulty: "", category: "" })}
              className="text-xs text-text-tertiary hover:text-text-primary px-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-1 py-1 min-h-0 max-h-[55vh]">
        {catalog.isLoading ? (
          <div className="flex flex-col gap-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-10 w-full rounded-md" />
            ))}
          </div>
        ) : catalog.error ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            <p>Couldn&apos;t load questions.</p>
            <button
              type="button"
              onClick={() => catalog.refresh()}
              className="mt-2 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
            >
              Retry
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            <p>No questions match.</p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-2 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {displayed.map((p) => {
              const slug = p.title_slug.toLowerCase();
              const isSolved = catalog.statusMap[slug] === "solved";
              return (
                <a
                  key={`${p.id}-${slug}`}
                  href={problemUrl(slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    onStart(p);
                    onClose();
                  }}
                  className="flex items-center justify-between gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-overlay"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">
                      {p.title}
                    </span>
                    {isSolved && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-verified"
                        strokeWidth={2.25}
                        aria-label="Solved"
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden max-w-[130px] truncate text-xs text-text-tertiary sm:inline">
                      {p.category}
                    </span>
                    <DifficultyBadgeNew difficulty={p.difficulty} size="sm" />
                  </div>
                </a>
              );
            })}
            {isTruncated && (
              <div className="py-2.5 text-center text-xs text-text-tertiary">
                Showing 100 of {filteredProblems.length}. Narrow it with search or filters.
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
