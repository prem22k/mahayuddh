"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Code,
  CornerDownLeft,
  LayoutGrid,
  NotebookPen,
  Search,
  Settings,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { getAllProblems } from "@/lib/data/sheets";
import { getCatalogBySlugs, searchCatalogProblems } from "@/lib/data/problems";
import { listPrimers, primerReadMinutes } from "@/lib/data/primers";
import { getActiveSquadMembers } from "@/lib/data/squads";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { ModalShell } from "@/components/ui/ModalShell";
import { Avatar } from "@/components/ui/Avatar";
import { ListProblem, Primer, Problem } from "@/types/database";
import { useSolving } from "@/components/providers/SolvingProvider";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProblemHit {
  id: string | number;
  title: string;
  title_slug: string;
  difficulty: string;
  category: string;
  order_index: number;
  /** LeetCode question number for display. Sheet rows only know their
   * position in the sheet, which is a different number, so it comes from
   * the catalog and stays empty until the catalog says. */
  number?: string;
}

type Item =
  | { kind: "problem"; key: string; problem: ProblemHit }
  | { kind: "primer"; key: string; primer: Primer }
  | { kind: "pattern"; key: string; topic: string }
  | { kind: "person"; key: string; person: { id: string; username: string } }
  | { kind: "action"; key: string; action: PaletteAction };

type GroupId = "problems" | "patterns" | "people" | "actions";
type Filter = "all" | "problems" | "patterns" | "people";

interface PaletteAction {
  label: string;
  hint: string;
  href: string;
  Icon: typeof Search;
  keywords: string;
}

/** Plain navigation: every target is a real route, nothing is promised. */
const ACTIONS: PaletteAction[] = [
  { label: "Open the Arena", hint: "Today's battle", href: "/home", Icon: Swords, keywords: "arena home today battle daily" },
  { label: "Practice", hint: "Sheets and patterns", href: "/practice", Icon: Code, keywords: "practice sheets problems" },
  { label: "Your squad", hint: "Goals, streak, wall", href: "/squad", Icon: Users, keywords: "squad team invite join" },
  { label: "Challenges", hint: "Send or answer a 1v1", href: "/challenges", Icon: Trophy, keywords: "challenge 1v1 duel send" },
  { label: "Leaderboard", hint: "Squad and global", href: "/leaderboard", Icon: Trophy, keywords: "leaderboard rank" },
  { label: "Notebook", hint: "Your notes", href: "/notebook", Icon: NotebookPen, keywords: "notebook notes vault" },
  { label: "Pattern hub", hint: "Every topic", href: "/patterns", Icon: LayoutGrid, keywords: "patterns topics hub" },
  { label: "Settings", hint: "Profile, LeetCode, notifications", href: "/profile", Icon: Settings, keywords: "settings profile account leetcode notifications" },
];

const GROUP_LABEL: Record<GroupId, string> = {
  problems: "Problems",
  patterns: "Patterns & primers",
  people: "People",
  actions: "Actions",
};

/** Marks the first match. Neutral weight + underline: gold is reserved. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-text-primary underline decoration-text-tertiary underline-offset-[3px]">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [problems, setProblems] = useState<ListProblem[]>([]);
  const [catalogResults, setCatalogResults] = useState<Problem[]>([]);
  const [sheetNumbers, setSheetNumbers] = useState<Record<string, string>>({});
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const extrasLoaded = useRef(false);
  const restoreFocus = useRef<HTMLElement | null>(null);
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

  // Primers and squad mates load once, on first open. A failed read leaves
  // that group out (and is retried next open) rather than inventing rows.
  useEffect(() => {
    if (!isOpen || extrasLoaded.current) return;
    extrasLoaded.current = true;
    listPrimers()
      .then(setPrimers)
      .catch((e) => {
        extrasLoaded.current = false;
        console.error("Palette primers error:", e);
      });
    getActiveSquadMembers()
      .then(setMembers)
      .catch((e) => {
        extrasLoaded.current = false;
        console.error("Palette people error:", e);
      });
  }, [isOpen]);

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
      restoreFocus.current =
        typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      setTimeout(() => inputRef.current?.focus(), 50);
      setActiveIndex(0);
    } else {
      setQuery("");
      setCatalogResults([]);
      setFilter("all");
      // Hand focus back to whatever opened the palette (search button, page).
      const el = restoreFocus.current;
      restoreFocus.current = null;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
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

  // LeetCode numbers for the sheet rows on screen (the catalog search only
  // covers rows that also matched it).
  const filteredSlugKey = filtered.slice(0, 50).map((p) => p.title_slug).join(",");
  useEffect(() => {
    const missing = filteredSlugKey.split(",").filter((s) => s && !(s in sheetNumbers));
    if (missing.length === 0) return;
    let cancelled = false;
    getCatalogBySlugs(missing)
      .then((rows) => {
        if (cancelled || rows.length === 0) return;
        setSheetNumbers((prev) => {
          const next = { ...prev };
          for (const r of rows) if (r.question_id) next[r.title_slug] = r.question_id;
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filteredSlugKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const combined = useMemo(() => {
    const map = new Map<string, ProblemHit>();

    for (const p of filtered) {
      map.set(p.title_slug, {
        id: p.id,
        title: p.title,
        title_slug: p.title_slug,
        difficulty: p.difficulty,
        category: p.category,
        order_index: p.order_index,
        number: sheetNumbers[p.title_slug],
      });
    }

    for (const c of catalogResults) {
      const existing = map.get(c.title_slug);
      if (existing) {
        existing.number = existing.number ?? (c.question_id || undefined);
        continue;
      }
      map.set(c.title_slug, {
        id: c.question_id || c.title_slug,
        title: c.title,
        title_slug: c.title_slug,
        difficulty: c.difficulty,
        category: c.topics?.[0] || "General",
        order_index: parseInt(c.question_id, 10) || 0,
        number: c.question_id || undefined,
      });
    }

    return Array.from(map.values());
  }, [filtered, catalogResults, sheetNumbers]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const problemItems: Item[] = combined
      .slice(0, 50)
      .map((p) => ({ kind: "problem", key: `p:${p.title_slug}`, problem: p }));

    const patternItems: Item[] = [];
    const peopleItems: Item[] = [];
    if (q) {
      for (const p of primers) {
        if (patternItems.length >= 3) break;
        if (p.title.toLowerCase().includes(q) || p.pattern.toLowerCase().includes(q)) {
          patternItems.push({ kind: "primer", key: `pr:${p.slug}`, primer: p });
        }
      }
      // Hub topics come from primers and from the catalog hits' own topics,
      // so every link lands on a hub that exists.
      const topics = new Set<string>();
      for (const t of [...primers.map((p) => p.pattern), ...catalogResults.flatMap((c) => c.topics ?? [])]) {
        if (t && t.toLowerCase().includes(q)) topics.add(t);
      }
      Array.from(topics)
        .slice(0, 3)
        .forEach((t) => patternItems.push({ kind: "pattern", key: `t:${t}`, topic: t }));

      for (const m of members) {
        if (peopleItems.length >= 5) break;
        if (m.username.toLowerCase().includes(q)) {
          peopleItems.push({ kind: "person", key: `u:${m.id}`, person: m });
        }
      }
    }

    const actionItems: Item[] = (q
      ? ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q))
      : ACTIONS.slice(0, 4)
    ).map((a) => ({ kind: "action", key: `a:${a.href}`, action: a }));

    const all: { id: GroupId; items: Item[] }[] = [
      { id: "problems", items: problemItems },
      { id: "patterns", items: patternItems },
      { id: "people", items: peopleItems },
      { id: "actions", items: actionItems },
    ];
    return all;
  }, [combined, primers, members, catalogResults, query]);

  const counts = {
    problems: groups[0].items.length,
    patterns: groups[1].items.length,
    people: groups[2].items.length,
  };
  const visibleGroups = groups
    .filter((g) => (filter === "all" ? true : g.id === filter))
    .filter((g) => g.items.length > 0 || (g.id === "problems" && loading));
  const flat = visibleGroups.flatMap((g) => g.items);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter]);

  if (!isOpen) return null;

  const handleSelectProblem = (p: ProblemHit) => {
    startSolving({
      id: p.order_index,
      title: p.title,
      slug: p.title_slug,
      difficulty: p.difficulty,
      category: p.category,
    });
    onClose();
  };

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  const activate = (item: Item) => {
    switch (item.kind) {
      case "problem":
        handleSelectProblem(item.problem);
        return;
      case "primer":
        go(`/primers/${encodeURIComponent(item.primer.slug)}`);
        return;
      case "pattern":
        go(`/patterns/${encodeURIComponent(item.topic)}`);
        return;
      case "person":
        go(`/u/${encodeURIComponent(item.person.username)}`);
        return;
      case "action":
        go(item.action.href);
        return;
    }
  };

  const moveTo = (next: number) => {
    setActiveIndex(next);
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveTo(Math.min(activeIndex + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveTo(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      const item = flat[activeIndex];
      if (item) {
        e.preventDefault();
        activate(item);
      }
    }
  };

  const q = query.trim();
  const total = counts.problems + counts.patterns + counts.people;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    { id: "problems", label: "Problems", count: counts.problems },
    { id: "patterns", label: "Patterns", count: counts.patterns },
    { id: "people", label: "Squad", count: counts.people },
  ];

  const optionId = (i: number) => `palette-opt-${i}`;
  const rowCls = (active: boolean) =>
    cn(
      "group flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
      active ? "bg-surface-overlay" : "hover:bg-surface-raised"
    );
  const tileCls =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface text-text-secondary";
  const enterHint = (active: boolean) =>
    active ? (
      <kbd className="kbd hidden md:inline-flex" aria-hidden>
        <CornerDownLeft className="h-3 w-3" strokeWidth={1.5} />
      </kbd>
    ) : null;

  let index = -1;

  return (
    <ModalShell
      label="Search problems, patterns, people, actions"
      onClose={onClose}
      zIndexClass="z-[300]"
      maxWidthClass="max-w-[640px]"
      alignTop
      panelClassName="overflow-hidden rounded-lg p-0 max-md:rounded-xl"
    >
      <div className="flex h-14 items-center gap-3 border-b border-hairline px-4">
        <Search className="h-5 w-5 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search problems, patterns, primers, people…"
          className="h-full w-full bg-transparent text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
          aria-label="Search"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="palette-results"
          aria-autocomplete="list"
          aria-activedescendant={flat.length > 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="kbd shrink-0">esc</kbd>
      </div>

      {q && (
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2">
          <div
            role="group"
            aria-label="Filter results"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]"
          >
            <span className="hidden shrink-0 text-xs text-text-tertiary md:inline">Filter:</span>
            {filters.map((f) => {
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setFilter(f.id);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors md:h-7 md:px-2.5",
                    on
                      ? "border-hairline-strong bg-surface-overlay text-text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary max-md:border-hairline"
                  )}
                >
                  {f.label}
                  <span className="font-mono text-[11px] text-text-tertiary tnum">
                    <span className="md:hidden">{f.count}</span>
                    <span className="hidden md:inline">({f.count})</span>
                  </span>
                </button>
              );
            })}
          </div>
          <span className="hidden shrink-0 font-mono text-xs text-text-tertiary tnum md:inline">
            {flat.length} {flat.length === 1 ? "match" : "matches"}
          </span>
        </div>
      )}

      <div
        ref={listRef}
        id="palette-results"
        role="listbox"
        aria-label="Results"
        className="max-h-[max(240px,min(60vh,calc(100dvh_-_20vw_-_13rem)))] overflow-y-auto p-2"
      >
        {visibleGroups.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm leading-6 text-text-secondary">
            Nothing matches &lsquo;{query}&rsquo;. Search covers problems, patterns,
            primers, and people in your squad.
          </div>
        ) : (
          visibleGroups.map((g) => (
            <div key={g.id} role="group" aria-label={GROUP_LABEL[g.id]} className="pb-1">
              <div className="px-3 pb-1.5 pt-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                {GROUP_LABEL[g.id]}
              </div>
              {g.id === "problems" && loading ? (
                <div className="space-y-2 px-1 pb-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-11 w-full" />
                  ))}
                </div>
              ) : (
                g.items.map((item) => {
                  index += 1;
                  const i = index;
                  const active = i === activeIndex;
                  const common = {
                    id: optionId(i),
                    role: "option" as const,
                    "aria-selected": active,
                    "data-index": i,
                    onClick: () => activate(item),
                    onMouseEnter: () => setActiveIndex(i),
                    className: rowCls(active),
                  };

                  if (item.kind === "problem") {
                    const p = item.problem;
                    return (
                      <div key={item.key} {...common}>
                        <StatusGlyph status="none" />
                        <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
                          <span className="block truncate text-sm font-medium text-text-primary md:min-w-0 md:flex-1">
                            <Highlight text={p.title} query={q} />
                          </span>
                          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:mt-0 md:shrink-0 md:flex-nowrap">
                            {p.number && (
                              <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                                No. {p.number}
                              </span>
                            )}
                            <DifficultyBadgeNew difficulty={p.difficulty} size="sm" />
                            <PatternChip label={p.category} className="whitespace-nowrap" />
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {enterHint(active)}
                          <ProblemLink
                            slug={p.title_slug}
                            className="inline-flex h-11 w-8 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary md:h-7 md:w-7"
                          />
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === "primer") {
                    const pr = item.primer;
                    const starters = pr.starter_slugs?.length ?? 0;
                    return (
                      <div key={item.key} {...common}>
                        <span className={cn(tileCls, "text-pattern")} aria-hidden>
                          <BookOpen className="h-4 w-4" strokeWidth={1.5} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            <Highlight text={pr.title} query={q} />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-text-tertiary">
                            Primer · {pr.pattern}
                            {starters > 0 && ` · ${starters} starter ${starters === 1 ? "problem" : "problems"}`}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-text-tertiary tnum">
                          <span className="hidden md:inline" title="Estimated from length">
                            ~{primerReadMinutes(pr)}m read
                          </span>
                          {enterHint(active) ?? <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
                        </span>
                      </div>
                    );
                  }

                  if (item.kind === "pattern") {
                    return (
                      <div key={item.key} {...common}>
                        <span className={tileCls} aria-hidden>
                          <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            <Highlight text={item.topic} query={q} />
                          </p>
                          <p className="mt-0.5 text-xs text-text-tertiary">Pattern hub</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="hidden h-6 items-center rounded-full border border-hairline px-2 font-mono text-[11px] text-text-tertiary md:inline-flex">
                            Hub
                          </span>
                          {enterHint(active) ?? (
                            <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                          )}
                        </span>
                      </div>
                    );
                  }

                  if (item.kind === "person") {
                    const m = item.person;
                    return (
                      <div key={item.key} {...common}>
                        <Avatar name={m.username} size="md" className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            <Highlight text={m.username} query={q} />
                          </p>
                          <p className="mt-0.5 truncate font-mono text-xs text-text-tertiary">@{m.username}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {enterHint(active)}
                          <a
                            href={`/challenges?to=${m.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              go(`/challenges?to=${m.id}`);
                            }}
                            className="inline-flex h-11 items-center rounded-md border border-hairline px-3 text-xs font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary md:h-8"
                          >
                            Challenge
                          </a>
                        </span>
                      </div>
                    );
                  }

                  const a = item.action;
                  return (
                    <div key={item.key} {...common}>
                      <span className={tileCls} aria-hidden>
                        <a.Icon className="h-4 w-4" strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          <Highlight text={a.label} query={q} />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-text-tertiary">{a.hint}</p>
                      </div>
                      {enterHint(active) ?? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-hairline px-4 py-3 text-xs text-text-tertiary md:gap-4">
        <span className="flex items-center gap-1.5">
          <kbd className="kbd" aria-hidden>
            <ArrowUp className="h-3 w-3" strokeWidth={1.5} />
          </kbd>
          <kbd className="kbd" aria-hidden>
            <ArrowDown className="h-3 w-3" strokeWidth={1.5} />
          </kbd>
          <span>
            <span className="md:hidden">move</span>
            <span className="hidden md:inline">to move</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="kbd" aria-hidden>
            <CornerDownLeft className="h-3 w-3" strokeWidth={1.5} />
          </kbd>
          <span>
            <span className="md:hidden">open</span>
            <span className="hidden md:inline">to open</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">esc</kbd>
          <span>
            <span className="md:hidden">close</span>
            <span className="hidden md:inline">to close</span>
          </span>
        </span>
      </div>
    </ModalShell>
  );
}
