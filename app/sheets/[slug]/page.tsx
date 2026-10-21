"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Route,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSheetWithCatalog,
  getSquadProblemStatuses,
  setProblemStatus,
  batchSetProblemStatuses,
} from "@/lib/data/sheets";
import { parseProblemStatusEvent, applyStatusChange } from "@/lib/problemStatusEvent";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { PageLoader } from "@/components/ui/PageLoader";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { ProblemStatusCell } from "@/components/matrix/ProblemStatusCell";
import { MatrixCell, MatrixLegendSwatch } from "@/components/matrix/MatrixCell";
import { SplitBar } from "@/components/matrix/SplitBar";
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
    // A collapsed group has no rows to scroll to: open it first.
    const category = problems.find((p) => p.title_slug === problemSlug)?.category;
    if (category && collapsedCategories[category]) {
      setCollapsedCategories((prev) => ({ ...prev, [category]: false }));
    }
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

  // "No. 121" is the LeetCode number when the catalog has it, else the
  // sheet position — the same field the search box matches.
  const numberOf = (p: ListProblem): string =>
    catalogBySlug.get(p.title_slug)?.question_id || String(p.order_index);

  const isVerifiedSolve = (slug: string) =>
    statuses[slug] === "solved" && Boolean(viewerVerified[slug]);

  // Metrics computation across entire sheet
  const totalCount = problems.length;
  const solvedCount = problems.filter((p) => statuses[p.title_slug] === "solved").length;
  const verifiedCount = problems.filter((p) => isVerifiedSolve(p.title_slug)).length;
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
      problem.order_index.toString().includes(searchQuery) ||
      numberOf(problem).includes(searchQuery);

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

  // A category gets a pattern-hub link only when the catalog tags one of its
  // problems with exactly that topic — so the link never lands on an empty hub.
  const hubTopicFor = (category: string, rows: ListProblem[]): string | null => {
    const want = category.toLowerCase();
    for (const p of rows) {
      const hit = topicSet(p.title_slug).find((t) => t.toLowerCase() === want);
      if (hit) return hit;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-8" aria-hidden>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-md space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-full" />
          </div>
          <Skeleton className="h-24 w-full md:w-80" />
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const title = list?.title || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const clearFilters = () => {
    setStatusFilter("All");
    setSelectedCategory("All");
    setSearchQuery("");
  };
  const shownGroups = showAllCategories ? problemsByCategory : problemsByCategory.slice(0, 8);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Heading + progress summary */}
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0">
          {list && (
            <span className="mb-2.5 inline-flex items-center gap-2 rounded-xs border border-hairline bg-surface px-2 py-0.5">
              <Route className="h-3.5 w-3.5 text-pattern" strokeWidth={1.5} aria-hidden />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                {list.is_curated ? "Curated roadmap" : "Custom sheet"}
              </span>
            </span>
          )}
          <h1 className="type-display-md text-text-primary">{title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-snug text-text-secondary md:text-[15px] md:leading-6">
            {list?.description || "A structured path through the problems that cover the core patterns."}
          </p>
        </div>
        <div className="w-full shrink-0 rounded-lg border border-hairline bg-surface p-3.5 md:w-80 md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em] text-text-primary tnum">
                {solvedCount}
                <span className="hidden md:inline"> of {totalCount}</span>
              </span>
              <span className="text-sm text-text-secondary md:hidden">of {totalCount} solved</span>
            </span>
            <span className="font-mono text-xs font-medium text-text-secondary tnum">
              {percentage}% complete
            </span>
          </div>
          <SplitBar
            total={totalCount}
            verified={verifiedCount}
            selfReported={solvedCount - verifiedCount}
            label={`${title} progress`}
            className="mb-2.5 h-2"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-hairline pt-2 font-mono text-[11px] text-text-tertiary md:border-0 md:pt-0">
            <DifficultyTally pips={1} label="Easy" solved={easySolved} total={easyProblems.length} />
            <DifficultyTally pips={2} label="Med" solved={mediumSolved} total={mediumProblems.length} />
            <DifficultyTally pips={3} label="Hard" solved={hardSolved} total={hardProblems.length} />
          </div>
          {solvedCount > 0 && (
            <p className="mt-2 flex items-center gap-3 font-mono text-[11px] text-text-tertiary tnum">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-verified" aria-hidden />
                {verifiedCount} verified
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-text-secondary" aria-hidden />
                {solvedCount - verifiedCount} self-reported
              </span>
            </p>
          )}
        </div>
      </section>

      {/* Matrix overview */}
      <section
        aria-label="Progress by category"
        className="rounded-lg border border-hairline bg-surface p-3.5 md:p-6"
      >
        <div className="mb-3.5 flex items-start justify-between gap-4 md:mb-6 md:items-center md:border-b md:border-hairline md:pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-text-primary md:text-lg md:leading-[26px]">
              Category Matrix
            </h2>
            <p className="mt-0.5 text-[11px] leading-4 text-text-secondary md:text-xs">
              <span className="md:hidden">Tap a cell to jump to its problem.</span>
              <span className="hidden md:inline">
                Click any cell to jump to its problem. Hover for details
                {showSquad ? " and squad solvers." : "."}
              </span>
            </p>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-text-tertiary tnum md:text-xs">
            {showAllCategories || problemsByCategory.length <= 8
              ? `${problemsByCategory.length} categories`
              : `Showing 8 of ${problemsByCategory.length}`}
          </span>
        </div>

        {problemsByCategory.length === 0 ? (
          <p className="py-6 text-center text-sm leading-6 text-text-tertiary">
            No problems match these filters.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 md:gap-3">
            {shownGroups.map((group) => {
              const groupSolved = group.problems.filter((p) => statuses[p.title_slug] === "solved").length;
              const complete = groupSolved === group.problems.length;
              const active = selectedCategory === group.category;
              return (
                <div
                  key={group.category}
                  className="flex flex-col gap-1.5 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] md:items-center md:gap-4 md:py-1"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(active ? "All" : group.category)}
                    aria-pressed={active}
                    title={active ? "Show all categories" : `Filter to ${group.category}`}
                    className={cn(
                      "-mx-2 flex min-h-[44px] items-center justify-between gap-2 rounded-md px-2 text-left transition-colors md:min-h-9",
                      active ? "bg-surface-overlay" : "hover:bg-surface-raised"
                    )}
                  >
                    <span className="truncate text-xs font-medium leading-4 text-text-primary md:text-sm md:leading-5">
                      {group.category}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[11px] tnum md:text-xs",
                        active ? "text-text-primary" : complete ? "text-text-primary" : "text-text-secondary"
                      )}
                    >
                      {groupSolved}/{group.problems.length}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {group.problems.map((p) => (
                      <MatrixCell
                        key={p.title_slug}
                        title={p.title}
                        number={`No. ${numberOf(p)}`}
                        difficulty={p.difficulty}
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
        )}

        {problemsByCategory.length > 8 && (
          <div className="mt-3 md:mt-4 md:flex md:justify-center md:border-t md:border-hairline md:pt-3">
            <button
              type="button"
              onClick={() => setShowAllCategories((v) => !v)}
              aria-expanded={showAllCategories}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-raised/80 px-3 text-xs font-medium leading-4 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-8 md:w-auto md:border-transparent md:bg-transparent md:text-[13px]"
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", showAllCategories && "rotate-180")}
                strokeWidth={1.5}
              />
              {showAllCategories ? "Show fewer categories" : `+ Show all ${problemsByCategory.length} categories`}
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-3 font-mono text-[11px] text-text-tertiary md:mt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 md:gap-x-5">
            <MatrixLegendSwatch label="Verified" kind="verified" />
            <MatrixLegendSwatch label="Self-reported" kind="solved" />
            <MatrixLegendSwatch label="Attempted" kind="attempted" />
            <MatrixLegendSwatch label="To do" kind="todo" />
          </div>
          {showSquad && !squadError && (
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Users className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Squad solves tagged on cells
            </span>
          )}
        </div>
      </section>

      {/* Toolbar */}
      <section className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
          <div className="relative md:w-[280px]">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this sheet"
              aria-label="Search this sheet"
              className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none md:h-9 md:min-h-0 md:text-[13px] md:placeholder:text-text-disabled"
            />
          </div>
          <StatusFilterControl value={statusFilter} onChange={setStatusFilter} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showSquad}
          onClick={() => setShowSquad((v) => !v)}
          className="flex min-h-[44px] items-center gap-2.5 self-start rounded-md px-1 transition-colors hover:bg-surface-raised md:min-h-9 md:self-auto md:px-2"
        >
          <span className="text-[13px] font-medium leading-5 text-text-secondary">Show squad</span>
          <span
            className={cn(
              "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
              showSquad ? "justify-end bg-text-primary" : "border border-hairline-strong bg-well"
            )}
          >
            <span
              className={cn(
                "h-4 w-4 rounded-full shadow-sm",
                showSquad ? "bg-canvas" : "h-3.5 w-3.5 bg-text-secondary"
              )}
            />
          </span>
        </button>
      </section>
      {(selectedCategory !== "All" || squadError) && (
        <div className="-mt-2 space-y-1 md:-mt-4">
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
        </div>
      )}

      {/* Grouped problem list */}
      <div className="flex flex-col gap-3 md:gap-4">
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
            const groupVerified = group.problems.filter((p) => isVerifiedSolve(p.title_slug)).length;
            const groupTotal = group.problems.length;
            const groupPct = groupTotal > 0 ? Math.round((groupSolved / groupTotal) * 100) : 0;
            const hubTopic = hubTopicFor(group.category, group.problems);

            return (
              <section
                key={group.category}
                aria-label={group.category}
                className={cn(
                  "rounded-lg border border-hairline bg-surface transition-colors",
                  isCollapsed && "hover:border-hairline-strong"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-t-lg px-3 md:px-5",
                    isCollapsed
                      ? "rounded-b-lg py-1.5 md:py-2"
                      : "border-b border-hairline bg-surface-raised/40 py-1.5 md:py-2.5"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(group.category)}
                      aria-expanded={!isCollapsed}
                      className="flex min-h-[44px] min-w-0 items-center gap-2 text-left md:gap-3"
                    >
                      <ChevronRight
                        className={cn(
                          "h-5 w-5 shrink-0 transition-transform duration-200",
                          isCollapsed ? "text-text-tertiary" : "rotate-90 text-text-secondary"
                        )}
                        strokeWidth={1.5}
                      />
                      <span
                        className={cn(
                          "truncate font-display font-semibold text-text-primary",
                          isCollapsed ? "text-sm md:text-base" : "text-sm md:text-[17px]"
                        )}
                      >
                        {group.category}
                      </span>
                    </button>
                    {hubTopic && (
                      <PatternChip
                        label="Pattern hub"
                        href={`/patterns/${encodeURIComponent(hubTopic)}`}
                        className="h-5 shrink-0 rounded-xs px-2 font-mono text-[10px] md:text-[11px]"
                      />
                    )}
                    <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                      {groupSolved} of {groupTotal}
                      <span className="hidden md:inline"> solved</span>
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 md:gap-3">
                    <SplitBar
                      total={groupTotal}
                      verified={groupVerified}
                      selfReported={groupSolved - groupVerified}
                      label={`${group.category} progress`}
                      className="hidden h-1.5 w-24 sm:flex"
                    />
                    <span className="hidden w-9 text-right font-mono text-xs text-text-secondary tnum sm:inline">
                      {groupPct}%
                    </span>
                    {/* Bulk actions live behind the overflow menu: bulk
                        self-marking weakens proof, so it never gets top billing. */}
                    <details className="relative shrink-0">
                      <summary className="flex h-9 min-h-[44px] w-9 cursor-pointer list-none items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-0 [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                        <span className="sr-only">Section actions</span>
                      </summary>
                      <div className="popover-panel absolute right-0 top-full z-20 mt-1 min-w-[160px] p-1">
                        <button
                          type="button"
                          onClick={() => handleBatchToggleTopic(group.category, "solved")}
                          className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-9"
                        >
                          Mark solved
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchToggleTopic(group.category, "unsolved")}
                          className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-9"
                        >
                          Reset
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                {!isCollapsed && (
                  <ul className="divide-y divide-hairline">
                    {group.problems.map((problem) => {
                      const currentStatus = statuses[problem.title_slug] || "unsolved";
                      const verified = Boolean(viewerVerified[problem.title_slug]);
                      const isCurrentActive = activeProblem?.slug === problem.title_slug;
                      const highlighted = highlightedSlug === problem.title_slug;
                      const squadCount = showSquad ? squadSolvers[problem.title_slug] : undefined;
                      const actionLabel = isCurrentActive
                        ? "Solving"
                        : currentStatus === "solved"
                          ? "Practice"
                          : currentStatus === "attempted"
                            ? "Resume"
                            : "Start battle";

                      return (
                        <li
                          key={problem.id}
                          id={`sheet-row-${problem.title_slug}`}
                          className={cn(
                            "group flex scroll-mt-24 items-center gap-2.5 px-3 py-1.5 transition-colors last:rounded-b-lg md:gap-3.5 md:px-5 md:py-2",
                            highlighted ? "bg-surface-overlay" : "hover:bg-surface-raised/60"
                          )}
                        >
                          <ProblemStatusCell
                            status={currentStatus}
                            verified={verified}
                            onToggle={(next) => handleToggle(problem.title_slug, next)}
                            size="sm"
                            slug={problem.title_slug}
                          />

                          <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3.5">
                            {/* Meta line on mobile; flows inline before the title on desktop. */}
                            <div className="flex min-w-0 items-center gap-2 overflow-hidden md:contents">
                              <span className="shrink-0 font-mono text-xs text-text-tertiary tnum md:w-16">
                                No. {numberOf(problem)}
                              </span>
                              <DifficultyBadgeNew difficulty={problem.difficulty} size="sm" className="md:hidden" />
                              <RowStatusNote status={currentStatus} verified={verified} />
                              {squadCount != null && (
                                <span className="truncate text-[11px] leading-4 text-text-tertiary md:hidden">
                                  · {squadCount} solved
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/practice/${problem.title_slug}`}
                              className={cn(
                                "block min-w-0 truncate text-sm font-medium leading-5 transition-colors md:text-[15px] md:leading-6",
                                currentStatus === "unsolved" && !isCurrentActive
                                  ? "text-text-primary md:text-text-secondary md:group-hover:text-text-primary"
                                  : "text-text-primary",
                                "hover:underline"
                              )}
                            >
                              {problem.title}
                            </Link>
                            <DifficultyBadgeNew difficulty={problem.difficulty} className="hidden md:inline-flex" />
                          </div>

                          <div className="flex shrink-0 items-center gap-1 md:gap-5">
                            {squadCount != null && (
                              <span className="hidden items-center gap-1.5 text-xs font-medium leading-4 text-text-secondary md:flex">
                                <Users className="h-[15px] w-[15px] text-text-tertiary" strokeWidth={1.5} aria-hidden />
                                {squadCount} solved
                                {squadVerified[problem.title_slug] != null && (
                                  <span className="text-text-tertiary">
                                    · {squadVerified[problem.title_slug]} verified
                                  </span>
                                )}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartSolving(problem)}
                                aria-label={`${actionLabel}: ${problem.title}`}
                                className={cn(
                                  "inline-flex h-8 min-h-[44px] items-center gap-1 rounded-xs border px-2.5 text-xs font-medium leading-4 transition-[color,border-color,background-color,opacity] md:min-h-8 md:px-3",
                                  // Mobile keeps the row for the title: solved rows open via the chevron.
                                  currentStatus === "solved" && !isCurrentActive && "hidden md:inline-flex",
                                  isCurrentActive
                                    ? "border-hairline-strong bg-surface-overlay text-text-primary"
                                    : "border-hairline bg-surface-raised text-text-secondary hover:border-hairline-strong hover:text-text-primary",
                                  currentStatus === "unsolved" &&
                                    !isCurrentActive &&
                                    "md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                )}
                              >
                                {actionLabel === "Start battle" ? (
                                  <>
                                    <span className="md:hidden">Start</span>
                                    <span className="hidden md:inline">Start battle</span>
                                    <ArrowUpRight className="hidden h-3.5 w-3.5 md:block" strokeWidth={1.5} aria-hidden />
                                  </>
                                ) : (
                                  actionLabel
                                )}
                              </button>
                              <ProblemLink
                                slug={problem.title_slug}
                                title={`Open ${problem.title} on LeetCode`}
                                className="hidden rounded-md p-2 text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary md:inline-flex"
                              />
                              <Link
                                href={`/practice/${problem.title_slug}`}
                                aria-label={`Open ${problem.title}`}
                                className="flex h-11 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary md:hidden"
                              >
                                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                              </Link>
                            </div>
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

function DifficultyTally({
  pips,
  label,
  solved,
  total,
}: {
  pips: 1 | 2 | 3;
  label: string;
  solved: number;
  total: number;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap tnum">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("h-1 w-1 rounded-full", i <= pips ? "bg-text-secondary" : "bg-hairline-strong")}
          />
        ))}
      </span>
      {label} <span className="text-text-secondary">{solved}/{total}</span>
    </span>
  );
}

/** Mobile meta-line tag; desktop reads the same state from the glyph. */
function RowStatusNote({ status, verified }: { status: TriState; verified: boolean }) {
  if (status === "unsolved") return null;
  return (
    <span
      className={cn(
        "min-w-0 truncate text-[10px] leading-4 md:hidden",
        status === "solved" && verified ? "text-verified" : status === "solved" ? "text-text-tertiary" : "text-text-secondary"
      )}
    >
      {status === "solved" ? (verified ? "Verified" : "Self-reported") : "Attempted"}
    </span>
  );
}

function StatusFilterControl({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="flex flex-wrap items-center gap-1.5 md:flex-nowrap md:gap-0 md:rounded-md md:border md:border-hairline md:bg-surface md:p-0.5"
    >
      {STATUS_FILTERS.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o)}
            className={cn(
              "flex h-8 min-h-[44px] items-center rounded-full border px-3 text-xs font-medium leading-4 transition-colors md:h-7 md:min-h-0 md:rounded-xs md:border-0 md:text-[13px]",
              active
                ? "border-hairline-strong bg-surface-overlay text-text-primary md:shadow-sm"
                : "border-hairline text-text-secondary hover:text-text-primary"
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function SheetPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading roadmap..." />}>
      <SheetContent />
    </Suspense>
  );
}
