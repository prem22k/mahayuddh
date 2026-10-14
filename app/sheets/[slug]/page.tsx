"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Search,
  Check,
  Clock,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSheetWithCatalog,
  getSquadProblemStatuses,
  setProblemStatus,
  batchSetProblemStatuses,
} from "@/lib/data/sheets";
import { parseProblemStatusEvent, applyStatusChange } from "@/lib/problemStatusEvent";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { PageLoader } from "@/components/ui/PageLoader";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { FilterChips } from "@/components/ui/ProblemRow";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { ProblemStatusCell } from "@/components/matrix/ProblemStatusCell";
import { logProblemEvent } from "@/lib/data/problemEvents";
import { getVerifiedSolvers } from "@/lib/data/squadActivity";
import { getActiveSquadId, getSquadMemberIds } from "@/lib/data/squads";
import { track } from "@/lib/analytics";
import { CustomList, ListProblem, Problem, TriState } from "@/types/database";

const STATUS_FILTERS = ["All", "Solved", "Attempted", "To do"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedCategory, setSelectedCategory] = useState(initialCat || "All");
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  const [squadSolvers, setSquadSolvers] = useState<Record<string, number>>({});
  const [squadError, setSquadError] = useState<string | null>(null);
  // Verified overlay (honest data): slug -> viewer verified + squad verified
  // solver count. Solved + verified renders emerald; solved without it renders
  // the neutral self-reported state. Never inferred, only from problem_events
  // rows with metadata source 'leetcode'.
  const [viewerVerified, setViewerVerified] = useState<Record<string, boolean>>({});
  const [squadVerified, setSquadVerified] = useState<Record<string, number>>({});
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Squad overlay: distinct solvers per problem from shared statuses. When
  // the read fails (or RLS scopes it away) the toggle stays honest about it
  // instead of rendering confident zeros.
  useEffect(() => {
    if (!showSquad || problems.length === 0) return;
    let cancelled = false;
    setSquadError(null);
    getSquadProblemStatuses(problems.map((p) => p.title_slug))
      .then((rows) => {
        if (cancelled) return;
        const counts: Record<string, Set<string>> = {};
        for (const r of rows) {
          if (r.status !== "solved") continue;
          (counts[r.problem_slug] ??= new Set()).add(r.user_id);
        }
        setSquadSolvers(
          Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v.size]))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSquadSolvers({});
          setSquadError("Couldn't load squad progress. Cells show your progress.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showSquad, problems]);

  // Verified overlay: LeetCode-sourced solve/revisit events per slug. Loaded
  // for the viewer always (personal cells), and for the whole active squad
  // when the squad overlay is on. Failures keep the honest fallback: every
  // solved cell renders self-reported, never emerald.
  const viewerId = user?.id ?? null;
  useEffect(() => {
    if (!viewerId || problems.length === 0) {
      setViewerVerified({});
      setSquadVerified({});
      return;
    }
    let cancelled = false;
    const slugs = problems.map((p) => p.title_slug);
    getVerifiedSolvers(slugs, [viewerId])
      .then((map) => {
        if (cancelled) return;
        const rec: Record<string, boolean> = {};
        for (const [slug, set] of map) {
          if (set.has(viewerId)) rec[slug] = true;
        }
        setViewerVerified(rec);
      })
      .catch(() => {
        if (!cancelled) setViewerVerified({});
      });
    if (showSquad) {
      (async () => {
        try {
          const squadId = await getActiveSquadId(viewerId);
          const memberIds = squadId ? await getSquadMemberIds(squadId) : [viewerId];
          const map = await getVerifiedSolvers(slugs, memberIds);
          if (cancelled) return;
          setSquadVerified(
            Object.fromEntries([...map.entries()].map(([k, v]) => [k, v.size]))
          );
        } catch {
          if (!cancelled) setSquadVerified({});
        }
      })();
    } else {
      setSquadVerified({});
    }
    return () => {
      cancelled = true;
    };
  }, [problems, viewerId, showSquad]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  // Refresh status when the dock marks a problem done. Payloads are
  // validated — junk events are ignored, never merged.
  useEffect(() => {
    const onStatusChanged = (e: Event) => {
      const parsed = parseProblemStatusEvent(e);
      if (parsed) {
        setStatuses((prev) => applyStatusChange(prev, parsed.slug, parsed.status));
      }
    };
    window.addEventListener("problem-status-changed", onStatusChanged);
    return () => window.removeEventListener("problem-status-changed", onStatusChanged);
  }, []);

  const handleToggle = async (problemSlug: string, next: TriState): Promise<boolean> => {
    // Optimistic UI update, rolled back when the write fails.
    const prev = statuses[problemSlug];
    setStatuses((p) => applyStatusChange(p, problemSlug, next));
    if (!user) return true;
    const ok = await setProblemStatus(user.id, problemSlug, next);
    if (!ok) {
      setStatuses((p) => {
        const rolled = { ...p };
        if (prev) rolled[problemSlug] = prev;
        else delete rolled[problemSlug];
        return rolled;
      });
    } else if (next === "solved" || next === "attempted") {
      // Roadmap toggles are self-reported proof; the timeline records them.
      // Re-solving an already-solved row is a revisit, not a fresh solve.
      const kind = next === "solved" && prev === "solved" ? "revisited" : next;
      logProblemEvent({ problemSlug, kind }).catch(() => {});
      if (next === "solved") track("battle_solved", { problem_slug: problemSlug, via: "roadmap" });
      if (kind === "revisited") track("revisit_done", { problem_slug: problemSlug, via: "roadmap" });
    }
    return ok;
  };

  const handleBatchToggleTopic = async (categoryName: string, next: TriState) => {
    const categoryProblems = problems.filter((p) => p.category === categoryName);
    const slugs = categoryProblems.map((p) => p.title_slug);

    const snapshot = { ...statuses };
    const optimistic = { ...statuses };
    slugs.forEach((slug) => {
      if (next === "unsolved") delete optimistic[slug];
      else optimistic[slug] = next;
    });
    setStatuses(optimistic);

    if (!user) return;
    const ok = await batchSetProblemStatuses(user.id, slugs, next);
    if (!ok) {
      setStatuses(snapshot);
      return;
    }

    // Bulk writes must still land on the timeline: problem_events is the
    // history source of truth (§48), and a batch toggle used to leave zero
    // history rows — so a "solved" mark from the roadmap was invisible to the
    // Daily Battle signals and the problem timeline.
    const kinds = slugs.map((slug) => ({
      problemSlug: slug,
      kind: (next === "solved" && snapshot[slug] === "solved"
        ? "revisited"
        : next) as "solved" | "attempted" | "revisited",
    }));
    await Promise.all(kinds.map((k) => logProblemEvent(k).catch(() => {})));
    if (next === "solved") {
      track("battle_solved", { via: "roadmap_batch", count: slugs.length });
    }

    // Celebrate only persisted solves (confetti lazy-loaded at celebration time).
    if (next === "solved") {
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
    }
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

  const jumpToRow = (problemSlug: string) => {
    setHighlightedSlug(problemSlug);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedSlug(null), 2000);
    requestAnimationFrame(() => {
      document
        .getElementById(`sheet-row-${problemSlug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const topicSet = (slug: string): string[] =>
    catalogBySlug.get(slug)?.topics ?? [];

  // Metrics computation across entire sheet
  const totalCount = problems.length;
  const solvedCount = problems.filter((p) => statuses[p.title_slug] === "solved").length;
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
    if (statusFilter === "Solved" && status !== "solved") return false;
    if (statusFilter === "Attempted" && status !== "attempted") return false;
    if (statusFilter === "To do" && status !== "unsolved") return false;

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
  const categoryNames = categories.filter((c) => c !== "All");

  // Group filtered problems by category
  const problemsByCategory = categoryNames
    .map((cat) => ({
      category: cat,
      problems: filteredProblems.filter((p) => p.category === cat),
    }))
    .filter((group) => group.problems.length > 0);

  if (loading) {
    return (
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const title = list?.title || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const clearFilters = () => {
    setStatusFilter("All");
    setSelectedCategory("All");
    setSearchQuery("");
  };

  return (
    <div className="space-y-8">
      {/* Heading + progress summary */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="type-display-md text-text-primary">{title}</h1>
          <p className="mt-1 max-w-xl text-[15px] leading-6 text-text-secondary">
            {list?.description || "A structured path through the problems that cover the core patterns."}
          </p>
        </div>
        <div className="shrink-0 lg:w-64">
          <p className="font-mono text-sm text-text-primary tnum">
            {solvedCount} of {totalCount}
          </p>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-surface-overlay"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${title} progress`}
          >
            <div
              className="h-full rounded-full bg-text-primary transition-all duration-200"
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-xs text-text-tertiary tnum">
            Easy {easySolved}/{easyProblems.length} · Medium {mediumSolved}/{mediumProblems.length} · Hard {hardSolved}/{hardProblems.length}
          </p>
        </div>
      </div>

      {/* Matrix overview */}
      <section aria-label="Progress by category" className="card space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <MatrixLegendSwatch label="Verified" kind="verified" />
          <MatrixLegendSwatch label="Self-reported" kind="solved" />
          <MatrixLegendSwatch label="Attempted" kind="attempted" />
          <MatrixLegendSwatch label="To do" kind="todo" />
        </div>
        <div className="space-y-3">
          {(showAllCategories ? problemsByCategory : problemsByCategory.slice(0, 8)).map((group) => {
            const groupSolved = group.problems.filter((p) => statuses[p.title_slug] === "solved").length;
            const active = selectedCategory === group.category;
            return (
              <div
                key={group.category}
                className="grid grid-cols-1 gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:items-start"
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategory(active ? "All" : group.category)}
                  aria-pressed={active}
                  title={active ? "Show all categories" : `Filter to ${group.category}`}
                  className={cn(
                    "flex min-h-[44px] items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors md:min-h-0",
                    active ? "bg-surface-overlay" : "hover:bg-surface-raised"
                  )}
                >
                  <span className="truncate text-sm font-medium leading-5 text-text-primary">
                    {group.category}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                    {groupSolved}/{group.problems.length}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {group.problems.map((p) => (
                    <MatrixCell
                      key={p.title_slug}
                      title={p.title}
                      status={statuses[p.title_slug] || "unsolved"}
                      verified={Boolean(viewerVerified[p.title_slug])}
                      squadCount={showSquad ? squadSolvers[p.title_slug] : undefined}
                      squadVerifiedCount={showSquad ? squadVerified[p.title_slug] : undefined}
                      onOpen={() => jumpToRow(p.title_slug)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {problemsByCategory.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAllCategories((v) => !v)}
            className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
          >
            {showAllCategories ? "Show less" : `Show all ${problemsByCategory.length}`}
          </button>
        )}
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search this sheet"
            aria-label="Search this sheet"
            className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well pl-9 pr-3 text-[15px] leading-6 text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none md:min-h-0 lg:w-60"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <button
            type="button"
            role="switch"
            aria-checked={showSquad}
            onClick={() => setShowSquad((v) => !v)}
            className="flex h-9 min-h-[44px] items-center gap-2 rounded-md px-2 transition-colors hover:bg-surface-raised md:min-h-0"
          >
            <span
              className={cn(
                "flex h-5 w-9 items-center rounded-full border border-hairline bg-well p-0.5 transition-colors",
                showSquad && "justify-end border-hairline-strong bg-surface-overlay"
              )}
            >
              <span className="h-3.5 w-3.5 rounded-full bg-text-primary" />
            </span>
            <span className="text-sm font-medium leading-5 text-text-secondary">Show squad</span>
          </button>
        </div>
      </div>
      {selectedCategory !== "All" && (
        <p className="text-xs leading-4 text-text-tertiary">
          Showing {selectedCategory} ·{" "}
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className="font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary"
          >
            Clear
          </button>
        </p>
      )}
      {squadError && (
        <p role="status" className="text-xs leading-4 text-text-tertiary">{squadError}</p>
      )}

      {/* Grouped problem list */}
      <div className="space-y-4">
        {problemsByCategory.length === 0 ? (
          <EmptyState
            heading="No problems match these filters"
            body="Try a different search or clear the filters to see the whole sheet."
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          problemsByCategory.map((group) => {
            const isCollapsed = Boolean(collapsedCategories[group.category]);
            const groupSolved = group.problems.filter((p) => statuses[p.title_slug] === "solved").length;
            const groupTotal = group.problems.length;

            return (
              <section
                key={group.category}
                aria-label={group.category}
                className="overflow-hidden rounded-xl border border-hairline bg-surface"
              >
                <div className="flex items-center justify-between gap-2 border-b border-hairline bg-surface-raised/40 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleCategoryCollapse(group.category)}
                    aria-expanded={!isCollapsed}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left md:min-h-0"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200",
                        isCollapsed && "-rotate-90"
                      )}
                      strokeWidth={1.5}
                    />
                    <span className="truncate text-sm font-medium leading-5 text-text-primary">
                      {group.category}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                      {groupSolved} of {groupTotal}
                    </span>
                  </button>

                  {/* Bulk actions live behind the overflow menu: bulk
                      self-marking weakens proof, so it never gets top billing. */}
                  <details className="relative shrink-0">
                    <summary className="flex h-9 min-h-[44px] w-9 cursor-pointer list-none items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-0 [&::-webkit-details-marker]:hidden">
                      <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                      <span className="sr-only">Section actions</span>
                    </summary>
                    <div className="popover-panel absolute right-0 top-full z-20 mt-1 min-w-[160px] p-1">
                      <button
                        type="button"
                        onClick={() => handleBatchToggleTopic(group.category, "solved")}
                        className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-0"
                      >
                        Mark solved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBatchToggleTopic(group.category, "unsolved")}
                        className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-0"
                      >
                        Reset
                      </button>
                    </div>
                  </details>
                </div>

                {!isCollapsed && (
                  <ul className="divide-y divide-hairline">
                    {group.problems.map((problem) => {
                      const currentStatus = statuses[problem.title_slug] || "unsolved";
                      const isCurrentActive = activeProblem?.slug === problem.title_slug;
                      const highlighted = highlightedSlug === problem.title_slug;

                      return (
                        <li
                          key={problem.id}
                          id={`sheet-row-${problem.title_slug}`}
                          className={cn(
                            "group grid scroll-mt-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 transition-colors",
                            highlighted ? "bg-surface-overlay" : "hover:bg-surface-raised"
                          )}
                        >
                          <ProblemStatusCell
                            status={currentStatus}
                            verified={Boolean(viewerVerified[problem.title_slug])}
                            onToggle={(next) => handleToggle(problem.title_slug, next)}
                            size="sm"
                            slug={problem.title_slug}
                          />

                          <div className="min-w-0">
                            <Link
                              href={`/practice/${problem.title_slug}`}
                              className={cn(
                                "block truncate text-sm font-medium leading-5 transition-colors",
                                isCurrentActive ? "text-text-primary" : "text-text-primary hover:underline"
                              )}
                            >
                              {problem.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-text-tertiary tnum">
                                No. {problem.order_index}
                              </span>
                              <DifficultyBadgeNew difficulty={problem.difficulty} />
                              {currentStatus === "solved" &&
                                (viewerVerified[problem.title_slug] ? (
                                  <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-verified-tint px-2 text-xs font-medium leading-4 text-verified">
                                    <Check className="h-3 w-3" strokeWidth={2} />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex h-6 items-center rounded-sm border border-hairline-strong px-2 text-xs font-medium leading-4 text-text-secondary">
                                    Self-reported
                                  </span>
                                ))}
                              {showSquad && squadSolvers[problem.title_slug] != null && (
                                <span className="text-xs leading-4 text-text-tertiary">
                                  {squadSolvers[problem.title_slug]} solved
                                  {squadVerified[problem.title_slug] != null &&
                                    ` · ${squadVerified[problem.title_slug]} verified`}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartSolving(problem)}
                              className={cn(
                                "hidden h-10 min-h-[44px] items-center rounded-md px-3 text-sm font-medium leading-5 transition-colors md:min-h-0",
                                "text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus-visible:inline-flex md:group-hover:inline-flex md:group-focus-within:inline-flex",
                                isCurrentActive && "md:inline-flex"
                              )}
                            >
                              {isCurrentActive ? "Solving" : "Start"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartSolving(problem)}
                              className="inline-flex h-10 min-h-[44px] items-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:hidden"
                            >
                              {isCurrentActive ? "Solving" : "Start"}
                            </button>
                            <ProblemLink
                              slug={problem.title_slug}
                              title={`Open ${problem.title} on LeetCode`}
                              className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function MatrixLegendSwatch({
  label,
  kind,
}: {
  label: string;
  kind: "verified" | "solved" | "attempted" | "todo";
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs leading-4 text-text-tertiary">
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[4px] border",
          kind === "verified" && "border-verified/30 bg-verified-tint text-verified",
          kind === "solved" && "border-hairline-strong text-text-secondary",
          kind === "attempted" && "border-hairline-strong bg-surface-overlay text-text-secondary",
          kind === "todo" && "border-hairline bg-well"
        )}
        aria-hidden
      >
        {kind === "verified" || kind === "solved" ? (
          <Check className="h-2.5 w-2.5" strokeWidth={2} />
        ) : kind === "attempted" ? (
          <Clock className="h-2.5 w-2.5" strokeWidth={2} />
        ) : null}
      </span>
      {label}
    </span>
  );
}

function MatrixCell({
  title,
  status,
  verified,
  squadCount,
  squadVerifiedCount,
  onOpen,
}: {
  title: string;
  status: TriState;
  verified?: boolean;
  squadCount?: number;
  squadVerifiedCount?: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isVerified = status === "solved" && verified === true;
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        title={`${title} · ${statusLabel(status, verified)}`}
        aria-label={`${title} · ${statusLabel(status, verified)}`}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-sm border transition-colors",
          isVerified &&
            "border-verified/30 bg-verified-tint text-verified hover:bg-verified/25",
          status === "solved" &&
            !isVerified &&
            "border-hairline-strong text-text-secondary hover:bg-surface-raised hover:text-text-primary",
          status === "attempted" &&
            "border-hairline-strong bg-surface-overlay text-text-secondary hover:text-text-primary",
          status === "unsolved" && "border-hairline bg-well hover:border-hairline-strong"
        )}
      >
        {status === "solved" ? (
          <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : status === "attempted" ? (
          <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current" aria-hidden>
            <span className="absolute inset-0 overflow-hidden rounded-full" aria-hidden>
              <span className="block h-full w-1/2 bg-current opacity-40" />
            </span>
          </span>
        ) : null}
        {squadCount != null && squadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-hairline bg-surface-overlay px-1 font-mono text-[10px] leading-3 text-text-secondary tnum">
            {squadCount}
          </span>
        )}
      </button>
      {open && (
        <span className="popover-panel pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 p-2 text-left">
          <span className="block truncate text-xs font-medium leading-4 text-text-primary">
            {title}
          </span>
          <span className="mt-0.5 block text-xs leading-4 text-text-tertiary">
            {statusLabel(status, verified)}
            {squadCount != null &&
              ` · ${squadCount} solved${
                squadVerifiedCount != null ? ` (${squadVerifiedCount} verified)` : ""
              }`}
          </span>
        </span>
      )}
    </span>
  );
}

function statusLabel(status: TriState, verified?: boolean): string {
  if (status === "solved") return verified ? "Verified via LeetCode" : "Self-reported solve";
  if (status === "attempted") return "Attempted";
  return "To do";
}

export default function SheetPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading roadmap..." />}>
      <SheetContent />
    </Suspense>
  );
}
