"use client";

import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Command, Lock, Search, Send, Swords, TriangleAlert, X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { ChallengePassPreview } from "@/components/challenges/ChallengePassPreview";
import { slugifyTitle } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { createSuggestion } from "@/lib/data/suggestions";
import { getCatalogBySlugs, searchCatalogProblems } from "@/lib/data/problems";
import { getLatestBattle } from "@/lib/data/battles";
import { logFeedEvent } from "@/lib/data/feed";
import { notify } from "@/lib/data/notifications";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Difficulty, Problem, Profile, Suggestion } from "@/types/database";
import { track } from "@/lib/analytics";

const NOTE_MAX = 349;

function parseMmSs(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?([0-5]?\d)$/);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  return mins * 60 + parseInt(m[2], 10);
}

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PickedProblem {
  title: string;
  slug: string;
  difficulty: Difficulty;
  /** Catalog question number / first topic; null until (or unless) the catalog knows it. */
  number: string | null;
  pattern: string | null;
  /** False for a title typed in by hand: then the difficulty is the sender's pick. */
  fromCatalog: boolean;
}

/**
 * "Challenge someone" composer (Stitch modal on desktop, bottom sheet on
 * phones): recipient, problem from the catalog, optional time to beat, note,
 * due date, and a live preview of the pass they will get.
 */
export function SendChallengeModal({
  profiles,
  initialTo,
  initialProblem,
  initialBeatSec,
  passParent,
  onClose,
  onSent,
}: {
  profiles: Profile[];
  initialTo?: string;
  initialProblem?: { slug: string; title: string; difficulty: Difficulty };
  initialBeatSec?: number | null;
  passParent?: Suggestion | null;
  onClose: () => void;
  onSent: (s: Suggestion) => void;
}) {
  const { user, profile } = useAuth();
  const others = profiles.filter((p) => p.id !== user?.id);
  const recipients = others.length > 0 ? others : profiles;

  const [targetUserId, setTargetUserId] = useState(
    initialTo ?? others[0]?.id ?? profiles[0]?.id ?? ""
  );
  const seed = passParent
    ? { title: passParent.problem_title, slug: passParent.problem_slug, difficulty: passParent.difficulty }
    : initialProblem?.title
      ? initialProblem
      : null;
  const [problem, setProblem] = useState<PickedProblem | null>(
    seed ? { ...seed, number: null, pattern: null, fromCatalog: !!seed.slug } : null
  );
  const [picking, setPicking] = useState(!seed);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Problem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [beatTime, setBeatTime] = useState(initialBeatSec != null);
  const [myTime, setMyTime] = useState(initialBeatSec != null ? fmtTime(initialBeatSec) : "");
  const [timeHint, setTimeHint] = useState<string | null>(null);
  // A pass starts with an empty note: the forwarded hint was written by someone else.
  const [note, setNote] = useState("");
  const [hideNote, setHideNote] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isMac, setIsMac] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const seedSlug = seed?.slug ?? "";
  // Catalog facts (No. and pattern) for a prefilled problem. Decoration only:
  // a failed lookup leaves them off rather than guessing.
  useEffect(() => {
    if (!seedSlug) return;
    let live = true;
    getCatalogBySlugs([seedSlug])
      .then(([row]) => {
        if (!live || !row) return;
        setProblem((p) =>
          p && p.slug === row.title_slug
            ? { ...p, number: String(row.question_id), pattern: row.topics?.[0] ?? null, fromCatalog: true }
            : p
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [seedSlug]);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
    // A fresh composer starts at the problem search, but only where focusing
    // won't throw a phone keyboard over the sheet.
    if (!seedSlug && window.matchMedia("(min-width: 768px)").matches) searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  // Debounced catalog search while the picker is open.
  useEffect(() => {
    if (!picking) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    let live = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchCatalogProblems(q, 6)
        .then((rows) => {
          if (!live) return;
          setResults(rows);
          setSearchError(null);
        })
        .catch(() => {
          if (!live) return;
          setResults([]);
          setSearchError("Search failed. Retry, or use the title as typed.");
        })
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, picking]);

  useEffect(() => {
    if (createError) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [createError]);

  const target = profiles.find((p) => p.id === targetUserId);
  const options = recipients.some((p) => p.id === targetUserId) || !target ? recipients : [...recipients, target];
  const senderSecs = beatTime ? parseMmSs(myTime) : null;
  const fromHandle = profile ? `@${profile.username}` : null;
  const toHandle = target ? `@${target.username}` : null;
  const dueDate = deadline ? new Date(deadline + "T12:00:00") : null;
  const dueStub = dueDate
    ? dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase()
    : null;
  const daysAhead = deadline
    ? Math.round((new Date(deadline + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86_400_000)
    : null;
  const daysLabel =
    daysAhead == null ? null : daysAhead <= 0 ? "(today)" : daysAhead === 1 ? "(1 day)" : `(${daysAhead} days)`;
  const title = passParent ? "Pass it on" : "Challenge someone";
  const subtitle = passParent
    ? `Forwarding ${passParent.from_profile?.username ? `@${passParent.from_profile.username}` : "a squad mate"}'s challenge. The chain grows.`
    : `Friendly 1v1 · ${fromHandle ?? "You"} → ${toHandle ?? "pick a squad mate"}`;

  const choose = (p: Problem) => {
    setProblem({
      title: p.title,
      slug: p.title_slug,
      difficulty: p.difficulty,
      number: String(p.question_id),
      pattern: p.topics?.[0] ?? null,
      fromCatalog: true,
    });
    setPicking(false);
    setQuery("");
    setTimeHint(null);
  };

  const chooseTyped = () => {
    const t = query.trim();
    if (!t) return;
    setProblem({
      title: t,
      slug: slugifyTitle(t),
      difficulty: problem?.difficulty ?? "Medium",
      number: null,
      pattern: null,
      fromCatalog: false,
    });
    setPicking(false);
    setQuery("");
    setTimeHint(null);
  };

  const fillLatest = async () => {
    if (!problem?.slug) return;
    const latest = await getLatestBattle(problem.slug).catch(() => null);
    if (latest?.duration_sec != null) {
      setMyTime(fmtTime(latest.duration_sec));
      setTimeHint("Your latest on this problem");
    } else {
      setTimeHint("No timed solve of yours on this problem yet.");
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (!problem || !problem.title.trim()) {
      setCreateError("Pick a problem to challenge them on.");
      return;
    }
    if (!targetUserId) {
      setCreateError("Pick a squad member to challenge.");
      return;
    }
    if (targetUserId === user.id) {
      setCreateError("Challenge a squad mate, not yourself.");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    const problemTitle = problem.title;
    const difficulty = problem.difficulty;
    try {
      const slug = (problem.slug.trim().toLowerCase() || slugifyTitle(problemTitle)).slice(0, 80);
      if (beatTime && senderSecs == null) {
        setCreateError("Enter your solve time as m:ss (or turn off “Beat my time”).");
        setSubmitting(false);
        return;
      }
      const res = await createSuggestion({
        fromUser: user.id,
        toUser: targetUserId,
        problemTitle: problemTitle.trim(),
        problemSlug: slug,
        difficulty,
        message: note.trim(),
        senderTimeSec: senderSecs,
        beatTime,
        deadlineAt: deadline ? new Date(deadline + "T23:59:59").toISOString() : null,
        parentId: passParent?.id ?? null,
        spoiler: hideNote,
      });

      if (res.ok) {
        track("challenge_sent", { problem_slug: slug, beat_time: beatTime, pass: !!passParent });
        notify({
          userId: targetUserId,
          kind: "challenge",
          title: `${profile ? `@${profile.username}` : "A squad mate"} challenged you`,
          body: `${problemTitle.trim()} · ${difficulty}`,
          deepLink: `/c/${res.suggestion.id}`,
          actorId: user.id,
          urgent: true,
        }).catch(() => {});
        logFeedEvent({
          eventType: "challenge",
          squadId: profile?.active_squad_id ?? null,
          problemTitle: problemTitle.trim(),
          problemSlug: slug,
          difficulty,
          objectId: res.suggestion.id,
          metadata: passParent ? { parent_id: passParent.id } : {},
        }).catch(() => {});
        onSent(res.suggestion);
        onClose();
        try {
          const confetti = (await import("canvas-confetti")).default;
          confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.8 },
            colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
          });
        } catch {
          // ignore
        }
      } else if (res.reason === "duplicate") {
        setCreateError("This squad mate already has a pending challenge for that problem.");
      } else if (res.reason === "invalid") {
        setCreateError("Check the problem slug (lowercase letters, numbers, dashes) and keep hints under 2000 characters.");
      } else {
        setCreateError("Couldn't send the challenge. Please try again.");
      }
    } catch {
      setCreateError("Couldn't send the challenge. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "text-[13px] font-medium leading-5 text-text-secondary";
  const fieldCls =
    "rounded-md border border-hairline bg-well text-sm text-text-primary placeholder:text-text-disabled hover:border-hairline-strong focus:border-hairline-strong focus:outline-none";

  return (
    <ModalShell
      label={title}
      onClose={onClose}
      variant="sheet"
      // Above the shell's battle dock and phone tab bar, like the other composers.
      zIndexClass="z-[300]"
      maxWidthClass="max-w-[740px]"
      panelClassName="flex max-h-[92dvh] flex-col overflow-hidden p-0 md:max-h-[calc(100dvh-2rem)]"
    >
      <form
        ref={formRef}
        onSubmit={send}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 pb-4 pt-6 md:px-6 md:pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-well text-text-secondary md:h-8 md:w-8">
              <Swords className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.015em] text-text-primary md:text-2xl">
                {title}
              </h2>
              <p className="mt-0.5 truncate text-[13px] leading-5 text-text-secondary">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary md:-mr-1 md:mt-0 md:h-8 md:min-h-0 md:w-8 md:min-w-0"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            {createError && (
              <div
                ref={errorRef}
                role="alert"
                className="order-first flex items-start gap-3 rounded-md border border-error/30 bg-error-tint p-3 text-xs leading-5 text-error md:col-span-2"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span>{createError}</span>
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-4">
              {/* To */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="ch-to" className={labelCls}>
                    To
                  </label>
                  {others.length > 0 && (
                    <span className="font-mono text-[11px] font-medium leading-4 tracking-[0.04em] text-text-tertiary tnum">
                      {others.length} squad {others.length === 1 ? "mate" : "mates"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  {target && (
                    <Avatar
                      name={target.username}
                      src={target.avatar_url}
                      size="sm"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    />
                  )}
                  <select
                    id="ch-to"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className={cn(fieldCls, "h-11 w-full appearance-none pr-10 font-medium md:h-10", target ? "pl-11" : "pl-3")}
                  >
                    {options.length === 0 && <option value="">No squad mates yet</option>}
                    {options.map((p) => (
                      <option key={p.id} value={p.id} className="bg-surface-raised text-text-primary">
                        @{p.username}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
              </div>

              {/* Problem */}
              <div className="flex flex-col gap-1.5">
                <span id="ch-problem-label" className={labelCls}>
                  Problem
                </span>
                {picking ? (
                  <div className="rounded-md border border-hairline bg-well p-2">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <input
                        id="ch-problem"
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            if (results[0]) choose(results[0]);
                            else chooseTyped();
                          }
                        }}
                        ref={searchRef}
                        autoComplete="off"
                        aria-labelledby="ch-problem-label"
                        placeholder="Search by title or number"
                        className="h-11 w-full rounded-sm border border-hairline bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:h-10"
                      />
                    </div>
                    {results.length > 0 && (
                      <ul className="mt-1.5 flex flex-col" aria-label="Matching problems">
                        {results.map((r) => (
                          <li key={r.title_slug}>
                            <button
                              type="button"
                              onClick={() => choose(r)}
                              className="flex min-h-[44px] w-full items-center gap-3 rounded-sm px-2.5 text-left transition-colors hover:bg-surface-raised md:min-h-9"
                            >
                              <span className="w-14 shrink-0 font-mono text-xs text-text-tertiary tnum">
                                No. {r.question_id}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{r.title}</span>
                              <DifficultyBadgeNew difficulty={r.difficulty} size="sm" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(searching || searchError || (query.trim().length >= 2 && results.length === 0)) && (
                      <p role="status" className="px-2.5 pt-2 text-xs leading-4 text-text-tertiary">
                        {searching ? "Searching…" : searchError ?? "No match in the catalog."}
                      </p>
                    )}
                    {(query.trim() || problem) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 border-t border-hairline px-1 pt-1.5">
                        {query.trim() && (
                          <button
                            type="button"
                            onClick={chooseTyped}
                            className="min-h-[44px] truncate text-left text-xs font-medium text-text-secondary underline decoration-hairline-strong underline-offset-[3px] hover:text-text-primary md:min-h-8"
                          >
                            Use &ldquo;{query.trim()}&rdquo; as typed
                          </button>
                        )}
                        {problem && (
                          <button
                            type="button"
                            onClick={() => {
                              setPicking(false);
                              setQuery("");
                            }}
                            className="ml-auto min-h-[44px] text-xs font-medium text-text-secondary hover:text-text-primary md:min-h-8"
                          >
                            Keep {problem.title}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : problem ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-well p-3">
                    <div className="min-w-0">
                      <span className="hidden text-xs font-medium leading-4 text-text-tertiary md:block">
                        Selected problem
                      </span>
                      <div className="flex min-w-0 items-baseline gap-2 md:mt-0.5">
                        <span className="truncate text-sm font-medium leading-5 text-text-primary">{problem.title}</span>
                        {problem.number && (
                          <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
                            No. {problem.number}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {problem.fromCatalog || passParent ? (
                          <DifficultyBadgeNew difficulty={problem.difficulty} size="sm" />
                        ) : (
                          <select
                            aria-label="Difficulty"
                            value={problem.difficulty}
                            onChange={(e) =>
                              setProblem((p) => (p ? { ...p, difficulty: e.target.value as Difficulty } : p))
                            }
                            className="h-9 rounded-sm border border-hairline bg-surface px-2 text-xs text-text-secondary focus:border-hairline-strong focus:outline-none md:h-7"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        )}
                        {problem.pattern && <PatternChip label={problem.pattern} className="h-5 px-2 text-[11px]" />}
                      </div>
                    </div>
                    {!passParent && (
                      <button
                        type="button"
                        onClick={() => {
                          setPicking(true);
                          setQuery("");
                        }}
                        className="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary md:min-h-8"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Time to beat */}
              <div className="flex flex-col gap-3 rounded-md border border-hairline bg-well p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span id="ch-beat-label" className="text-sm font-medium leading-5 text-text-primary">
                      Beat my time
                    </span>
                    <p className="text-xs leading-4 text-text-tertiary">
                      {beatTime ? "They race the time you set." : "No time to beat. They just solve it."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={beatTime}
                    aria-labelledby="ch-beat-label"
                    onClick={() => setBeatTime((b) => !b)}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end md:min-h-8"
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors",
                        beatTime ? "border-text-primary bg-text-primary" : "border-hairline-strong bg-surface-overlay"
                      )}
                    >
                      <span
                        className={cn(
                          "h-[18px] w-[18px] rounded-full transition-transform",
                          beatTime ? "translate-x-5 bg-canvas" : "bg-text-secondary"
                        )}
                      />
                    </span>
                  </button>
                </div>
                {beatTime && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-3">
                    <input
                      id="ch-time"
                      type="text"
                      value={myTime}
                      onChange={(e) => {
                        setMyTime(e.target.value);
                        setTimeHint(null);
                      }}
                      placeholder="m:ss"
                      aria-label="Time to beat, minutes and seconds"
                      className="type-mono-lg h-11 w-32 rounded-md border border-hairline bg-surface px-3 text-center text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:h-10"
                    />
                    <div className="flex min-w-0 flex-col">
                      {timeHint && <span className="text-xs leading-4 text-text-secondary">{timeHint}</span>}
                      {problem?.slug && (
                        <button
                          type="button"
                          onClick={fillLatest}
                          className="min-h-[44px] self-start text-xs font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-7"
                        >
                          Use my latest
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="ch-note" className={labelCls}>
                    Note (optional)
                  </label>
                  <span className="font-mono text-[11px] text-text-tertiary tnum">
                    {note.length} / {NOTE_MAX}
                  </span>
                </div>
                <textarea
                  id="ch-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                  rows={2}
                  placeholder="Hint, encouragement, or nothing."
                  className={cn(fieldCls, "w-full resize-none px-3 py-2.5 leading-6")}
                />
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] leading-5 text-text-secondary md:min-h-0 md:pt-1">
                  <input
                    type="checkbox"
                    checked={hideNote}
                    onChange={(e) => setHideNote(e.target.checked)}
                    className="h-4 w-4 accent-text-primary"
                  />
                  <Lock className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                  Hide the note until they finish
                </label>
              </div>

              {/* Due */}
              <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-well py-1.5 pl-3 pr-1.5 md:py-1.5">
                <label htmlFor="ch-due" className="flex items-center gap-2 text-[13px] font-medium leading-5 text-text-secondary">
                  <CalendarDays className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                  Due date
                </label>
                <div className="flex items-center gap-2">
                  {daysLabel && <span className="text-xs text-text-tertiary">{daysLabel}</span>}
                  <input
                    id="ch-due"
                    type="date"
                    min={todayISO()}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="h-11 rounded-sm border border-hairline bg-surface px-2 font-mono text-xs text-text-primary [color-scheme:dark] focus:border-hairline-strong focus:outline-none md:h-8"
                  />
                </div>
              </div>
            </div>

            {/* Live preview (top of the sheet on phones, right column on desktop) */}
            <div className="order-first flex min-w-0 flex-col gap-2 md:order-none">
              <div className="flex items-center justify-between px-1">
                <span className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.06em] text-text-tertiary">
                  Pass preview
                </span>
                <span className="font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-text-disabled">
                  What they get
                </span>
              </div>
              <ChallengePassPreview
                fromHandle={fromHandle}
                toHandle={toHandle}
                title={problem?.title.trim() ?? ""}
                number={problem?.number ?? null}
                difficulty={problem?.difficulty ?? "Medium"}
                beat={beatTime && senderSecs != null ? fmtTime(senderSecs) : null}
                note={note.trim()}
                noteHidden={hideNote && !!note.trim()}
                dueStub={dueStub}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-hairline bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:py-4">
          <span className="hidden items-center gap-2 font-mono text-xs font-medium tracking-[0.04em] text-text-tertiary md:flex">
            <Command className="h-4 w-4 text-text-disabled" strokeWidth={1.5} aria-hidden />
            {isMac ? "⌘ Enter" : "Ctrl Enter"} to send
          </span>
          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none md:gap-3">
            <Button variant="ghost" type="button" onClick={onClose} className="h-11 md:h-10">
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting} className="h-11 px-5 max-md:flex-1 md:h-10">
              <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Send challenge
            </Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
