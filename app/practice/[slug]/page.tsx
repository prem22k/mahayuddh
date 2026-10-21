"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Bookmark, Check, ChevronRight, Copy, RotateCcw, Sparkles, Swords, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { NextBattle } from "@/components/recommend/NextBattle";
import { problemUrl } from "@/components/ui/ProblemLink";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getPrimersForPatterns } from "@/lib/data/primers";
import { setProblemStatus } from "@/lib/data/sheets";
import { BattleCard } from "@/components/battle/BattleCard";
import { getProblemTimeline, logProblemEvent } from "@/lib/data/problemEvents";
import { getBattlesForSlug } from "@/lib/data/battles";
import { getChallengesForSlug } from "@/lib/data/suggestions";
import { toggleBookmark, isBookmarked, getReviewForSlug } from "@/lib/data/review";
import { getApproachesForProblem, createApproach, setApproachVisibility, deleteApproach } from "@/lib/data/approaches";
import { BoundedAssistant } from "@/components/ai/BoundedAssistant";
import { FirstSolvePushPrompt } from "@/components/ui/FirstSolvePushPrompt";
import { dataErrorMessage } from "@/lib/data/errors";
import { formatDuration } from "@/lib/format";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import {
  VerifiedBadge,
  SelfReportedBadge,
  DifficultyBadgeNew,
  PatternChip,
} from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorCard } from "@/components/ui/States";
import { ProblemTabs, ProblemTab } from "@/components/practice/ProblemTabs";
import { OverflowMenu, OverflowItem } from "@/components/practice/OverflowMenu";
import { LatestResultCard } from "@/components/practice/LatestResultCard";
import { BattleTimeline } from "@/components/practice/BattleTimeline";
import { SquadOnProblem } from "@/components/practice/SquadOnProblem";
import { OpenChallenges, LearnFirst } from "@/components/practice/ProblemRail";
import { Problem, ProblemEvent, Approach, ApproachVisibility, Primer, Battle, Suggestion, ReviewItem, TriState } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

function fmtDur(sec: number | null): string {
  return formatDuration(sec) ?? "";
}

type Tab = "Your battles" | "Squad approaches" | "Your approach" | "Practice with AI";

const fieldCls =
  "mt-1 w-full rounded-md border border-hairline bg-well px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none";
const labelCls = "text-xs font-medium leading-4 text-text-secondary";

export default function ProblemPage() {
  const params = useParams<{ slug: string }>();
  const slug = (params.slug || "").toLowerCase();
  const { user, profile } = useAuth();
  const { startSolving } = useSolving();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState<TriState>("unsolved");
  const [timeline, setTimeline] = useState<ProblemEvent[]>([]);
  const [slugEvents, setSlugEvents] = useState<ProblemEvent[]>([]);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [challenges, setChallenges] = useState<Suggestion[]>([]);
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Your battles");

  const [coreIdea, setCoreIdea] = useState("");
  const [aPattern, setAPattern] = useState("");
  const [aTime, setATime] = useState("");
  const [aSpace, setASpace] = useState("");
  const [aKeyDetail, setAKeyDetail] = useState("");
  const [aEdgeCases, setAEdgeCases] = useState("");
  const [aMistakes, setAMistakes] = useState("");
  const [aCode, setACode] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [visibility, setVisibility] = useState<ApproachVisibility>("private");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [proofCopied, setProofCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // True dependency first: primers derive from the catalog's topics.
      const [catalog] = await getCatalogBySlugs([slug]);
      setProblem(catalog ?? null);
      const topics = catalog?.topics ?? [];
      // Everything else is independent — fetch concurrently, not serially.
      const statusPromise = (async (): Promise<TriState> => {
        if (!user) return "unsolved";
        const supabase = createClient();
        const { data: st } = await supabase
          .from("user_problem_status")
          .select("status")
          .eq("user_id", user.id)
          .eq("problem_slug", slug)
          .maybeSingle();
        return (((st as { status: TriState } | null)?.status ?? "unsolved") as TriState);
      })();
      const [
        primers,
        nextStatus,
        timeline,
        recent,
        approaches,
        bookmarked,
        battles,
        challenges,
        review,
      ] = await Promise.all([
        getPrimersForPatterns(topics).catch(() => []),
        statusPromise,
        user ? getProblemTimeline(slug, user.id) : Promise.resolve([] as ProblemEvent[]),
        getProblemTimeline(slug),
        getApproachesForProblem(slug).catch(() => []),
        user ? isBookmarked(slug).catch(() => false) : Promise.resolve(false),
        user ? getBattlesForSlug(slug, 5).catch(() => []) : Promise.resolve([] as Battle[]),
        user ? getChallengesForSlug(slug).catch(() => []) : Promise.resolve([] as Suggestion[]),
        user ? getReviewForSlug(slug).catch(() => null) : Promise.resolve(null),
      ]);
      setPrimers(primers);
      if (user) {
        setStatus(nextStatus);
        setTimeline(timeline);
      } else {
        setStatus("unsolved");
        setTimeline([]);
      }
      // Every visible event on this slug; the squad rail filters to members.
      setSlugEvents(recent);
      setApproaches(approaches);
      if (user) {
        setBookmarked(bookmarked);
        setBattles(battles);
        setChallenges(challenges);
        setReview(review);
      }
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load this problem. Retry."));
    } finally {
      setLoading(false);
    }
  }, [slug, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Battle cards and the compare page link here with #explain: land on the
  // write-up tab instead of a dead anchor.
  useEffect(() => {
    if (loading || typeof window === "undefined" || window.location.hash !== "#explain") return;
    setTab("Your approach");
    requestAnimationFrame(() =>
      document.getElementById("explain")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [loading]);

  const handleStatus = async (next: TriState) => {
    if (!user) return;
    const prev = status;
    setStatus(next);
    const ok = await setProblemStatus(user.id, slug, next);
    if (!ok) {
      setStatus(prev);
      return;
    }
    if (next === "solved" || next === "attempted") {
      const kind = next === "solved" && prev === "solved" ? "revisited" : next;
      logProblemEvent({ problemSlug: slug, kind }).catch(() => {});
      if (kind === "revisited") track("revisit_done", { problem_slug: slug, via: "problem" });
      window.dispatchEvent(new CustomEvent("problem-status-changed", { detail: { slug, status: next } }));
      load();
    }
  };

  const handleSaveApproach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !coreIdea.trim()) return;
    if (visibility === "squad" && !profile?.active_squad_id) {
      setFormError("Join or activate a squad first to share with a squad.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createApproach({
        problemSlug: slug,
        coreIdea,
        pattern: aPattern,
        complexityTime: aTime,
        complexitySpace: aSpace,
        keyDetail: aKeyDetail,
        edgeCases: aEdgeCases,
        mistakes: aMistakes,
        code: aCode,
        visibility,
        squadId: profile?.active_squad_id ?? null,
      });
      track("approach_written", { problem_slug: slug, visibility });
      logProblemEvent({ problemSlug: slug, kind: "explained" }).catch(() => {});
      setCoreIdea("");
      setAPattern("");
      setATime("");
      setASpace("");
      setAKeyDetail("");
      setAEdgeCases("");
      setAMistakes("");
      setACode("");
      setExpanded(false);
      setVisibility("private");
      setApproaches(await getApproachesForProblem(slug).catch(() => []));
      load();
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't save approach."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Loading problem..." />;
  if (loadError) {
    return (
      <div className="space-y-3 p-12 text-center" role="alert">
        <ErrorCard message={loadError} onRetry={load} />
      </div>
    );
  }

  const title = problem?.title ?? slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  const topics = problem?.topics ?? [];
  const solvedBattles = battles.filter((b) => b.outcome === "solved" && b.duration_sec != null);
  const bestSec = solvedBattles.length ? Math.min(...solvedBattles.map((b) => b.duration_sec as number)) : null;
  const prevSec =
    solvedBattles.length > 1
      ? [...solvedBattles].sort((a, b) => (a.duration_sec as number) - (b.duration_sec as number))[1].duration_sec
      : null;
  const latest = battles[0] ?? null;
  const verified = latest ? latest.evidence === "leetcode" : status === "solved";
  const squadApproaches = approaches.filter((a) => a.user_id !== user?.id);
  const revisits = timeline.filter((ev) => ev.kind === "revisited").length;
  // Timeline entries the battles list doesn't already cover (BattleTimeline merges both).
  const battleIds = new Set(battles.map((b) => b.id));
  const looseEvents = timeline.filter((ev) => !(ev.battle_id && battleIds.has(ev.battle_id))).length;

  const startBattle = () =>
    problem &&
    startSolving({
      id: problem.question_id || slug,
      title,
      slug,
      difficulty: problem.difficulty || "Medium",
      category: problem.topics?.[0] || "General",
    });

  const openExplain = () => {
    setTab("Your approach");
    requestAnimationFrame(() =>
      document.getElementById("approach-form")?.scrollIntoView({ behavior: "smooth" })
    );
  };

  const stats = [
    `${battles.length} ${battles.length === 1 ? "attempt" : "attempts"}`,
    revisits > 0 ? `${revisits} ${revisits === 1 ? "revisit" : "revisits"}` : null,
    challenges.length > 0
      ? `${challenges.length} open ${challenges.length === 1 ? "challenge" : "challenges"}`
      : null,
    squadApproaches.length > 0
      ? `${squadApproaches.length} squad ${squadApproaches.length === 1 ? "approach" : "approaches"}`
      : null,
  ].filter((s): s is string => Boolean(s));

  const overflow: OverflowItem[] = [
    ...(user && status !== "solved" ? [{ label: "Mark solved", onSelect: () => handleStatus("solved") }] : []),
    ...(user && status !== "attempted" && status !== "solved"
      ? [{ label: "Mark attempted", onSelect: () => handleStatus("attempted") }]
      : []),
  ];

  const tabs: ProblemTab<Tab>[] = [
    { value: "Your battles", label: "Your battles", count: battles.length + looseEvents },
    { value: "Squad approaches", label: "Squad approaches", count: approaches.length },
    { value: "Your approach", label: "Your approach" },
    {
      value: "Practice with AI",
      label: "Practice with AI",
      shortLabel: "AI Practice",
      icon: <Sparkles className="hidden h-4 w-4 text-pattern md:block" strokeWidth={1.5} aria-hidden />,
    },
  ];

  return (
    <div className="select-none">
      {/* Problem header. Phones stack: crumb, title, chips, status, actions.
          Desktop puts the actions beside the title. */}
      <header className="flex flex-col gap-3 border-b border-hairline pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 lg:gap-y-3.5">
        <nav
          aria-label="Breadcrumb"
          className="order-1 flex min-w-0 items-center gap-1.5 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary lg:col-span-2 md:gap-2"
        >
          <Link
            href="/practice"
            className="inline-flex min-h-[44px] shrink-0 items-center transition-colors hover:text-text-primary md:min-h-0"
          >
            Practice
          </Link>
          <span aria-hidden className="hidden md:inline">/</span>
          <span className="hidden truncate text-text-secondary md:inline">{title}</span>
          {problem && (
            <>
              <span aria-hidden className="md:hidden">›</span>
              <span className="shrink-0 tnum md:hidden">No. {problem.question_id}</span>
            </>
          )}
          {topics[0] && (
            <>
              <span aria-hidden className="md:hidden">›</span>
              <span className="truncate font-sans tracking-normal text-text-secondary md:hidden">
                {topics[0]}
              </span>
            </>
          )}
        </nav>

        <h1 className="order-2 font-display text-[22px] font-semibold leading-snug tracking-[-0.015em] text-text-primary md:text-[32px] md:leading-9 md:tracking-[-0.02em] lg:col-start-1 lg:row-start-2 lg:self-center">
          {title}
        </h1>

        <div className="order-3 flex flex-wrap items-center gap-2 lg:col-span-2 lg:row-start-3 md:gap-3 lg:pt-1">
          {problem && (
            <span className="hidden h-6 items-center rounded-xs border border-hairline bg-well px-2 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum md:inline-flex">
              No. {problem.question_id}
            </span>
          )}
          {problem && <DifficultyBadgeNew difficulty={problem.difficulty} />}
          {topics.slice(0, 2).map((t) => (
            <PatternChip key={t} label={t} href={`/patterns/${encodeURIComponent(t)}`} />
          ))}
          <span aria-hidden className="hidden text-hairline-strong md:inline">|</span>
          <div className="flex w-full items-center justify-between gap-2 pt-1 md:w-auto md:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              {status === "solved" ? (
                <>
                  {verified ? <VerifiedBadge /> : <SelfReportedBadge />}
                  <span className="text-xs font-medium leading-4 text-text-secondary">
                    Solved
                    {bestSec != null && (
                      <>
                        {" · best "}
                        <span className="font-mono font-semibold text-text-primary tnum">{fmtDur(bestSec)}</span>
                      </>
                    )}
                  </span>
                </>
              ) : status === "attempted" ? (
                <span className="text-xs font-medium leading-4 text-text-secondary">Attempted · finish the battle.</span>
              ) : (
                <span className="text-xs font-medium leading-4 text-text-secondary">Not attempted yet.</span>
              )}
            </div>
            {problem && (
              <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum md:hidden">
                LeetCode #{problem.question_id}
              </span>
            )}
          </div>
        </div>

        <div className="order-4 flex items-center gap-2 lg:col-start-2 lg:row-start-2 lg:self-center">
          <button
            type="button"
            onClick={startBattle}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-3 text-sm font-medium leading-5 text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay md:h-10 md:flex-none md:gap-2 md:px-4"
          >
            <Swords className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
            {status === "solved" ? "Battle again" : "Start battle"}
          </button>
          <a
            href={problemUrl(slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-hairline px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary md:h-10 md:px-3.5"
          >
            <span className="md:hidden">LeetCode</span>
            <span className="hidden md:inline">Open on LeetCode</span>
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </a>
          <button
            type="button"
            onClick={async () => setBookmarked(await toggleBookmark(slug))}
            title="Bookmark for revision"
            aria-label={bookmarked ? "Bookmarked for revision" : "Bookmark for revision"}
            aria-pressed={bookmarked}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-raised transition-colors hover:border-hairline-strong hover:text-text-primary md:h-10 md:w-10 md:bg-transparent",
              bookmarked ? "text-primary" : "text-text-secondary"
            )}
          >
            <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.5} fill={bookmarked ? "currentColor" : "none"} />
          </button>
          <OverflowMenu items={overflow} label="More problem actions" />
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Focal column */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <LatestResultCard
            latest={latest}
            bestSec={bestSec}
            prevSec={prevSec}
            verified={verified}
            stats={stats}
            copied={proofCopied}
            onStart={startBattle}
            onExplain={openExplain}
            onChallenge={() => (window.location.href = "/challenges")}
            onCompare={() => (window.location.href = `/practice/${slug}/compare`)}
            onShare={async () => {
              if (await copyText(`${window.location.origin}/practice/${slug}`)) {
                setProofCopied(true);
                setTimeout(() => setProofCopied(false), 2000);
              }
            }}
            onHint={() => (window.location.href = "/stuck")}
          />

          {/* Contextual push prompt: once, after a solve, wired to the bell flow. */}
          {user && status === "solved" && <FirstSolvePushPrompt />}

          <div id="explain" className="flex scroll-mt-24 flex-col gap-4">
            <ProblemTabs tabs={tabs} value={tab} onChange={setTab} />

            {tab === "Your battles" && (
              <section className="space-y-3" aria-label="Your battles">
                <BattleTimeline battles={battles} timeline={timeline} />
                {user &&
                  battles
                    .filter((b) => b.outcome === "solved" || b.outcome === "failed")
                    .slice(0, 1)
                    .map((b) => <BattleCard key={b.id} battleId={b.id} onCompareAvailable={squadApproaches.length > 0} />)}
              </section>
            )}

            {tab === "Squad approaches" && (
              <section className="space-y-3" aria-label="Squad approaches">
                {approaches.length === 0 ? (
                  <div className="rounded-lg border border-hairline bg-surface p-4 md:p-6">
                    <h3 className="text-base font-semibold leading-6 text-text-primary">No approaches yet</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      When someone in your squad explains their solution, it shows up here.
                    </p>
                  </div>
                ) : (
                  approaches.map((a) => (
                    <article
                      key={a.id}
                      className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong md:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={a.author?.username || "Member"}
                            src={a.author?.avatar_url}
                            size="md"
                          />
                          <span className="truncate text-sm font-semibold leading-5 text-text-primary">
                            @{a.author?.username || "you"}
                          </span>
                          {a.user_id === user?.id && (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-xs border border-primary/20 bg-primary-tint px-1.5 font-mono text-[11px] font-medium text-primary">
                              You
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="mr-1 inline-flex h-6 items-center rounded-xs border border-hairline bg-well px-2 text-[11px] font-medium capitalize leading-4 text-text-tertiary">
                            {a.visibility}
                          </span>
                          <button
                            onClick={async () => {
                              if (await copyText(a.core_idea)) {
                                setCopiedId(a.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text-primary md:h-9 md:w-9"
                            aria-label="Copy approach"
                          >
                            {copiedId === a.id ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                          </button>
                          {a.user_id === user?.id && (
                            <button
                              onClick={async () => {
                                await deleteApproach(a.id);
                                setApproaches(await getApproachesForProblem(slug).catch(() => []));
                              }}
                              className="flex h-11 w-11 items-center justify-center rounded-md text-text-tertiary hover:text-error md:h-9 md:w-9"
                              aria-label="Delete approach"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                        </span>
                      </div>
                      <div>
                        <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                          Core idea
                        </p>
                        <p className="text-[15px] leading-6 text-text-primary">{a.core_idea}</p>
                      </div>
                      {(a.complexity_time || a.complexity_space) && (
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-hairline py-2.5 font-mono text-xs tnum">
                          <span>
                            <span className="text-text-tertiary">Time: </span>
                            <span className="font-medium text-text-primary">{a.complexity_time || "?"}</span>
                          </span>
                          <span aria-hidden className="text-hairline-strong">·</span>
                          <span>
                            <span className="text-text-tertiary">Space: </span>
                            <span className="font-medium text-text-primary">{a.complexity_space || "?"}</span>
                          </span>
                        </p>
                      )}
                      {a.code ? (
                        revealed[a.id] ? (
                          <pre className="overflow-x-auto rounded-md border border-hairline bg-well p-4 font-mono text-sm leading-[22px] text-text-primary">
                            {a.code}
                          </pre>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline bg-well p-3">
                            <span className="text-xs font-medium leading-4 text-text-secondary">
                              Code hidden until you reveal it
                            </span>
                            <button
                              type="button"
                              className="inline-flex h-11 items-center rounded-sm border border-hairline bg-surface-overlay px-3 text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] md:h-8"
                              onClick={() => setRevealed((r) => ({ ...r, [a.id]: true }))}
                            >
                              Reveal code
                            </button>
                          </div>
                        )
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/approach/${a.id}`}
                          className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium leading-5 text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary"
                        >
                          Read full approach
                        </Link>
                        {a.user_id === user?.id && (
                          <select
                            value={a.visibility}
                            onChange={async (e) => {
                              const v = e.target.value as ApproachVisibility;
                              if (v === "squad" && !profile?.active_squad_id) return;
                              await setApproachVisibility(a.id, v, profile?.active_squad_id ?? null);
                              setApproaches(await getApproachesForProblem(slug).catch(() => []));
                            }}
                            className="h-11 rounded-md border border-hairline bg-well px-2.5 text-xs text-text-primary md:h-8"
                            title="Sharing is intentional and reversible"
                            aria-label="Who can read this approach"
                          >
                            <option value="private">Private</option>
                            <option value="squad">Squad</option>
                            <option value="public">Public</option>
                          </select>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}

            {tab === "Your approach" && (
              <section className="space-y-3" aria-label="Your approach">
                {user && status === "solved" ? (
                  <form
                    id="approach-form"
                    onSubmit={handleSaveApproach}
                    className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:p-6"
                  >
                    <div>
                      <h3 className="text-base font-semibold leading-6 text-text-primary">Explain your approach</h3>
                      <p className="mt-0.5 text-xs font-medium leading-4 text-text-tertiary">
                        Private by default. Share it with your squad when it reads right.
                      </p>
                    </div>
                    {formError && <div className="text-sm leading-6 text-error">{formError}</div>}
                    <label className="block">
                      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                        Core idea
                      </span>
                      <textarea
                        value={coreIdea}
                        onChange={(e) => setCoreIdea(e.target.value)}
                        rows={3}
                        maxLength={5000}
                        placeholder="Core idea in two sentences. What was the key insight?"
                        className="mt-1.5 w-full rounded-md border border-hairline bg-well p-3 text-sm leading-6 text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpanded((v) => !v)}
                      className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-medium leading-5 text-text-secondary hover:text-text-primary md:min-h-9"
                    >
                      <ChevronRight
                        className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      {expanded ? "Fewer details" : "Add complexity, key detail, edge cases, mistakes, code"}
                    </button>
                    {expanded && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className={labelCls}>Pattern</span>
                          <input
                            value={aPattern}
                            onChange={(e) => setAPattern(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. Two pointers"
                            className={fieldCls}
                          />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Time</span>
                          <input
                            value={aTime}
                            onChange={(e) => setATime(e.target.value)}
                            maxLength={40}
                            placeholder="e.g. O(n)"
                            className={cn(fieldCls, "font-mono")}
                          />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Space</span>
                          <input
                            value={aSpace}
                            onChange={(e) => setASpace(e.target.value)}
                            maxLength={40}
                            placeholder="e.g. O(1)"
                            className={cn(fieldCls, "font-mono")}
                          />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Key detail</span>
                          <input
                            value={aKeyDetail}
                            onChange={(e) => setAKeyDetail(e.target.value)}
                            maxLength={500}
                            placeholder="The one thing that makes it work"
                            className={fieldCls}
                          />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Edge cases</span>
                          <input
                            value={aEdgeCases}
                            onChange={(e) => setAEdgeCases(e.target.value)}
                            maxLength={1000}
                            placeholder="Empty input, duplicates, single element…"
                            className={fieldCls}
                          />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Mistakes</span>
                          <input
                            value={aMistakes}
                            onChange={(e) => setAMistakes(e.target.value)}
                            maxLength={1000}
                            placeholder="What you got wrong first"
                            className={fieldCls}
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className={labelCls}>Code</span>
                          <textarea
                            value={aCode}
                            onChange={(e) => setACode(e.target.value)}
                            rows={4}
                            maxLength={20000}
                            placeholder="Your final solution."
                            className={cn(fieldCls, "p-3 font-mono leading-[22px]")}
                          />
                        </label>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as ApproachVisibility)}
                        aria-label="Who can read this approach"
                        className="h-11 rounded-md border border-hairline bg-well px-2.5 text-sm text-text-primary md:h-10"
                      >
                        <option value="private">Private</option>
                        <option value="squad">Squad</option>
                        <option value="public">Public</option>
                      </select>
                      <Button variant="primary" className="h-11 md:h-10" loading={saving} disabled={!coreIdea.trim()}>
                        Save approach
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-lg border border-hairline bg-surface p-4 md:p-6">
                    <p className="text-sm leading-6 text-text-secondary">
                      Solve it first, or reveal anyway. Your write-up unlocks after a solve.
                    </p>
                  </div>
                )}
              </section>
            )}

            {tab === "Practice with AI" && (
              <section className="grid gap-3 md:grid-cols-2" aria-label="Practice with AI">
                {user && status === "solved" && profile?.active_squad_id ? (
                  <>
                    <BoundedAssistant
                      feature="explain-back"
                      squadId={profile.active_squad_id}
                      problemSlug={slug}
                      problemTitle={problem?.title ?? null}
                      input={coreIdea}
                    />
                    <BoundedAssistant
                      feature="interview-sim"
                      squadId={profile.active_squad_id}
                      problemSlug={slug}
                      problemTitle={problem?.title ?? null}
                      input={coreIdea}
                    />
                  </>
                ) : null}
                {user && status === "attempted" && profile?.active_squad_id ? (
                  <BoundedAssistant
                    feature="explain-mistake"
                    squadId={profile.active_squad_id}
                    problemSlug={slug}
                    problemTitle={problem?.title ?? null}
                  />
                ) : null}
                {(!user || status === "unsolved") && (
                  <div className="rounded-lg border border-hairline bg-surface p-4 md:col-span-2 md:p-6">
                    <p className="flex items-start gap-2 text-sm leading-6 text-text-secondary">
                      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-pattern" strokeWidth={1.5} aria-hidden />
                      Attempt the problem first. These tools respond to your work, they never hand over code.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          {review && (
            <Link
              href="/practice"
              className="flex min-h-[44px] items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm leading-6 transition-colors hover:border-hairline-strong hover:bg-surface-raised"
            >
              <RotateCcw className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-text-primary">Review due: {review.reason.replace("_", " ")}</span>
                <span className="text-text-secondary"> — open your practice queue</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
            </Link>
          )}

          <NextBattle surface="problem" />
        </div>

        {/* Rail */}
        <aside className="flex min-w-0 flex-col gap-6 pt-1 lg:col-span-4 lg:pt-0">
          <SquadOnProblem
            slug={slug}
            userId={user?.id ?? null}
            username={profile?.username ?? null}
            avatarUrl={profile?.avatar_url}
            selfStatus={status}
            selfBestSec={bestSec}
            selfVerified={verified}
            events={slugEvents}
          />
          <OpenChallenges challenges={challenges} userId={user?.id ?? null} />
          <LearnFirst primers={primers} />
        </aside>
      </div>
    </div>
  );
}
