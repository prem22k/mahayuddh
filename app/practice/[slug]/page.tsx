"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Check, Trash2, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { NextBattle } from "@/components/recommend/NextBattle";
import { ProblemLink } from "@/components/ui/ProblemLink";
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
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import {
  VerifiedBadge,
  SelfReportedBadge,
  DifficultyBadgeNew,
  PatternChip,
} from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import { ErrorCard } from "@/components/ui/States";
import { Problem, ProblemEvent, ProblemEventKind, Approach, ApproachVisibility, Primer, Battle, Suggestion, ReviewItem, TriState } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const KIND_LABEL: Record<ProblemEventKind, { label: string; cls: string }> = {
  solved: { label: "Solved", cls: "bg-verified-tint text-verified border border-verified/30" },
  attempted: { label: "Attempted", cls: "bg-surface-overlay text-text-secondary border border-hairline-strong" },
  explained: { label: "Explained", cls: "bg-pattern-tint text-pattern border border-pattern/30" },
  revisited: { label: "Revisited", cls: "bg-pattern-tint text-pattern border border-pattern/30" },
  challenge_completed: { label: "Challenge completed", cls: "bg-verified-tint text-verified border border-verified/30" },
  failed: { label: "Failed", cls: "bg-error-tint text-error border border-error/30" },
  stuck: { label: "Stuck", cls: "bg-surface-overlay text-text-secondary border border-hairline-strong" },
};

function fmtDur(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const TABS = ["Your battles", "Squad approaches", "Your approach", "Practice with AI"] as const;

export default function ProblemPage() {
  const params = useParams<{ slug: string }>();
  const slug = (params.slug || "").toLowerCase();
  const { user, profile } = useAuth();
  const { startSolving } = useSolving();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState<TriState>("unsolved");
  const [timeline, setTimeline] = useState<ProblemEvent[]>([]);
  const [squadActivity, setSquadActivity] = useState<ProblemEvent[]>([]);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [challenges, setChallenges] = useState<Suggestion[]>([]);
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("Your battles");

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
  const [bookmarked, setBookmarked] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalog] = await getCatalogBySlugs([slug]);
      setProblem(catalog ?? null);
      setPrimers(await getPrimersForPatterns(catalog?.topics ?? []).catch(() => []));
      if (user) {
        const supabase = createClient();
        const { data: st } = await supabase
          .from("user_problem_status")
          .select("status")
          .eq("user_id", user.id)
          .eq("problem_slug", slug)
          .maybeSingle();
        setStatus(((st as { status: TriState } | null)?.status ?? "unsolved") as TriState);
        setTimeline(await getProblemTimeline(slug, user.id));
      } else {
        setStatus("unsolved");
        setTimeline([]);
      }
      const recent = await getProblemTimeline(slug);
      setSquadActivity(recent.slice(-10).reverse());
      setApproaches(await getApproachesForProblem(slug).catch(() => []));
      if (user) {
        setBookmarked(await isBookmarked(slug).catch(() => false));
        setBattles(await getBattlesForSlug(slug, 5).catch(() => []));
        setChallenges(await getChallengesForSlug(slug).catch(() => []));
        setReview(await getReviewForSlug(slug).catch(() => null));
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

  return (
    <div className="select-none">
      <Link
        href="/practice"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Practice</span>
      </Link>

      {/* Problem header */}
      <div className="mt-2">
        <h1 className="type-display-md text-text-primary">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-text-tertiary tnum">
            No. {problem?.question_id ?? "3"}
          </span>
          {problem && <DifficultyBadgeNew difficulty={problem.difficulty} />}
          {topics.slice(0, 2).map((t) => (
            <PatternChip key={t} label={t} href={`/patterns/${encodeURIComponent(t)}`} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {status === "solved" ? (
            <>
              <VerifiedBadge />
              <span className="text-sm leading-6 text-text-secondary">
                Solved{bestSec != null ? ` · best ${fmtDur(bestSec)}` : ""}
              </span>
            </>
          ) : status === "attempted" ? (
            <span className="text-sm leading-6 text-text-secondary">Attempted · finish the battle.</span>
          ) : (
            <span className="text-sm leading-6 text-text-secondary">Not attempted yet.</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-[44px]"
            onClick={() =>
              problem &&
              startSolving({
                id: problem.question_id || slug,
                title,
                slug,
                difficulty: problem.difficulty || "Medium",
                category: problem.topics?.[0] || "General",
              })
            }
          >
            {status === "solved" ? "Battle again" : "Start battle"}
          </Button>
          <span className="inline-flex min-h-[44px] items-center">
            <ProblemLink
              slug={slug}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            />
          </span>
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={async () => setBookmarked(await toggleBookmark(slug))}
            title="Bookmark for revision"
          >
            <Bookmark
              className="h-4 w-4"
              strokeWidth={1.5}
              fill={bookmarked ? "currentColor" : "none"}
            />
            {bookmarked ? "Bookmarked" : "Bookmark"}
          </Button>
          {user && status !== "solved" && (
            <Button variant="ghost" className="min-h-[44px]" onClick={() => handleStatus("solved")}>
              Mark solved
            </Button>
          )}
          {user && status !== "attempted" && status !== "solved" && (
            <Button variant="ghost" className="min-h-[44px]" onClick={() => handleStatus("attempted")}>
              Mark attempted
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Focal column */}
        <div className="min-w-0 space-y-6">
          {/* Latest battle result card */}
          {latest && (latest.outcome === "solved" || latest.outcome === "failed") ? (
            <section className="card space-y-3" aria-label="Latest battle result">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm leading-6 text-text-tertiary">Latest battle result</span>
                {bestSec != null && latest.outcome === "solved" && (
                  <span className="inline-flex h-6 items-center rounded-sm bg-primary-tint px-2 text-xs font-medium leading-4 text-primary">
                    Personal best
                  </span>
                )}
              </div>
              {latest.outcome === "solved" ? (
                <>
                  <div className="type-mono-display text-text-primary tnum">
                    {latest.duration_sec != null ? fmtDur(latest.duration_sec) : "—"}
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {prevSec != null && latest.duration_sec != null ? (
                      <>
                        <span className="line-through">{fmtDur(prevSec)}</span>
                        {" → "}
                        <span className="font-mono tnum">{fmtDur(latest.duration_sec)}</span>
                        {" · "}
                        {fmtDur((prevSec as number) - (latest.duration_sec as number))} faster
                      </>
                    ) : (
                      "First timed solve"
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {verified ? <VerifiedBadge /> : <SelfReportedBadge />}
                    <span className="text-sm leading-6 text-text-secondary">
                      {verified ? "Matched an accepted LeetCode submission" : "Logged without a LeetCode match"}
                    </span>
                  </div>
                  <p className="text-xs leading-4 text-text-tertiary">
                    {battles.length} attempts · {challenges.length} open challenges · {squadApproaches.length} squad approaches
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      className="min-h-[44px]"
                      onClick={() => {
                        setTab("Your approach");
                        document.getElementById("approach-form")?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Explain your approach
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => (window.location.href = "/challenges")}
                    >
                      Challenge someone
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => (window.location.href = `/practice/${slug}/compare`)}
                    >
                      Compare with squad
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={async () => {
                        await copyText(`${window.location.origin}/practice/${slug}`);
                      }}
                    >
                      Share proof
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm leading-6 text-text-primary">
                    Stopped at {latest.duration_sec != null ? fmtDur(latest.duration_sec) : "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      className="min-h-[44px]"
                      onClick={() =>
                        problem &&
                        startSolving({
                          id: problem.question_id || slug,
                          title,
                          slug,
                          difficulty: problem.difficulty || "Medium",
                          category: problem.topics?.[0] || "General",
                        })
                      }
                    >
                      Take revenge
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => (window.location.href = "/stuck")}
                    >
                      Ask for a hint
                    </Button>
                  </div>
                </>
              )}
            </section>
          ) : (
            <section className="card space-y-3" aria-label="Start your first battle">
              <p className="text-sm font-medium leading-5 text-text-primary">No result yet</p>
              <p className="text-sm leading-6 text-text-secondary">
                Start your first battle to get a time on the board.
              </p>
              <Button
                variant="primary"
                className="min-h-[44px]"
                onClick={() =>
                  problem &&
                  startSolving({
                    id: problem.question_id || slug,
                    title,
                    slug,
                    difficulty: problem.difficulty || "Medium",
                    category: problem.topics?.[0] || "General",
                  })
                }
              >
                Start battle
              </Button>
            </section>
          )}

          {/* Tabs */}
          <div className="overflow-x-auto">
            <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />
          </div>

          {tab === "Your battles" && (
            <section className="space-y-2" aria-label="Your battles">
              {timeline.length === 0 && battles.length === 0 ? (
                <div className="card">
                  <p className="text-sm leading-6 text-text-secondary">
                    No battles recorded yet. Your attempts, solves and revisits form a timeline here.
                  </p>
                </div>
              ) : (
                <>
                  {battles.map((b) => (
                    <div
                      key={b.id}
                      className="flex min-h-[44px] flex-wrap items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-5"
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-sm border px-2 text-xs font-medium leading-4",
                          KIND_LABEL[b.outcome === "solved" ? "solved" : b.outcome === "failed" ? "failed" : "attempted"].cls
                        )}
                      >
                        {b.outcome === "solved" ? "Solved" : b.outcome === "failed" ? "Failed" : b.outcome}
                      </span>
                      <span className="font-mono text-text-tertiary tnum">
                        {new Date(b.started_at).toLocaleDateString()}
                      </span>
                      {b.duration_sec != null && (
                        <span className="font-mono text-text-primary tnum">{fmtDur(b.duration_sec)}</span>
                      )}
                      <span className="text-xs leading-4 text-text-tertiary">
                        {b.evidence === "leetcode" ? "· LeetCode evidence" : "· Self-reported"}
                      </span>
                    </div>
                  ))}
                  {timeline
                    .filter((ev) => !battles.some((b) => b.id === ev.id))
                    .map((ev) => {
                      const k = KIND_LABEL[ev.kind];
                      const source = (ev.metadata as { source?: string })?.source;
                      return (
                        <div
                          key={ev.id}
                          className="flex min-h-[44px] flex-wrap items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-5"
                        >
                          <span className={cn("inline-flex h-6 items-center rounded-sm border px-2 text-xs font-medium leading-4", k.cls)}>
                            {k.label}
                          </span>
                          <span className="font-mono text-text-tertiary tnum">
                            {new Date(ev.created_at).toLocaleDateString()}
                          </span>
                          {ev.duration_sec != null && (
                            <span className="font-mono text-text-primary tnum">{fmtDur(ev.duration_sec)}</span>
                          )}
                          <span className="text-xs leading-4 text-text-tertiary">
                            {source === "leetcode" ? "· LeetCode evidence" : "· Self-reported"}
                          </span>
                        </div>
                      );
                    })}
                </>
              )}
              {user &&
                battles
                  .filter((b) => b.outcome === "solved" || b.outcome === "failed")
                  .slice(0, 1)
                  .map((b) => <BattleCard key={b.id} battleId={b.id} onCompareAvailable={squadApproaches.length > 0} />)}
            </section>
          )}

          {tab === "Squad approaches" && (
            <section className="space-y-2" aria-label="Squad approaches">
              {approaches.length === 0 ? (
                <div className="card">
                  <h3 className="font-display text-xl font-semibold text-text-primary">No approaches yet</h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    When someone in your squad explains their solution, it shows up here.
                  </p>
                </div>
              ) : (
                approaches.map((a) => (
                  <div key={a.id} className="card space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={a.author?.username || "Member"} size="sm" />
                        <span className="text-sm font-medium leading-5 text-text-primary">
                          @{a.author?.username || "you"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs leading-4 text-text-tertiary">{a.visibility}</span>
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
                    <p className="text-sm leading-6 text-text-primary">{a.core_idea}</p>
                    {(a.complexity_time || a.complexity_space) && (
                      <p className="font-mono text-xs text-text-tertiary tnum">
                        {a.complexity_time || "?"} · {a.complexity_space || "?"}
                      </p>
                    )}
                    {a.code ? (
                      revealed[a.id] ? (
                        <pre className="overflow-x-auto rounded-md bg-well p-4 font-mono text-sm leading-6 text-text-primary">
                          {a.code}
                        </pre>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-well px-4 py-3">
                          <span className="text-xs leading-4 text-text-secondary">Code hidden until you reveal it</span>
                          <Button
                            variant="secondary"
                            className="min-h-[44px]"
                            onClick={() => setRevealed((r) => ({ ...r, [a.id]: true }))}
                          >
                            Reveal code
                          </Button>
                        </div>
                      )
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/approach/${a.id}`}
                        className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary"
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
                          className="rounded-md border border-hairline bg-well px-2 py-1.5 text-xs text-text-primary"
                          title="Sharing is intentional and reversible"
                        >
                          <option value="private">Private</option>
                          <option value="squad">Squad</option>
                          <option value="public">Public</option>
                        </select>
                      )}
                    </div>
                  </div>
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
                  className="card space-y-3"
                >
                  <div className="text-sm font-medium leading-5 text-text-primary">Explain your approach</div>
                  {formError && <div className="text-sm leading-6 text-error">{formError}</div>}
                  <textarea
                    value={coreIdea}
                    onChange={(e) => setCoreIdea(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    placeholder="Core idea in two sentences. What was the key insight?"
                    className="w-full rounded-md border border-hairline bg-well p-3 text-sm leading-6 text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                  />
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                    className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary hover:text-text-primary"
                  >
                    {expanded ? "Fewer details" : "Add complexity, key detail, edge cases, mistakes, code"}
                  </button>
                  {expanded && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Pattern</span>
                        <input
                          value={aPattern}
                          onChange={(e) => setAPattern(e.target.value)}
                          maxLength={80}
                          placeholder="e.g. Two pointers"
                          className="mt-1 w-full rounded-md border border-hairline bg-well px-2.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Time</span>
                        <input
                          value={aTime}
                          onChange={(e) => setATime(e.target.value)}
                          maxLength={40}
                          placeholder="e.g. O(n)"
                          className="mt-1 w-full rounded-md border border-hairline bg-well px-2.5 py-2 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Space</span>
                        <input
                          value={aSpace}
                          onChange={(e) => setASpace(e.target.value)}
                          maxLength={40}
                          placeholder="e.g. O(1)"
                          className="mt-1 w-full rounded-md border border-hairline bg-well px-2.5 py-2 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Key detail</span>
                        <input
                          value={aKeyDetail}
                          onChange={(e) => setAKeyDetail(e.target.value)}
                          maxLength={500}
                          placeholder="The one thing that makes it work"
                          className="mt-1 w-full rounded-md border border-hairline bg-well px-2.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Edge cases</span>
                        <input
                          value={aEdgeCases}
                          onChange={(e) => setAEdgeCases(e.target.value)}
                          maxLength={1000}
                          placeholder="Empty input, duplicates, single element…"
                          className="mt-1 w-full rounded-md border border-hairline bg-well px-2.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Mistakes</span>
                        <input
                          value={aMistakes}
                          onChange={(e) => setAMistakes(e.target.value)}
                          maxLength={1000}
                          placeholder="What you got wrong first"
                          className="mt-1 w-full rounded-md border border-hairline bg-well px-2.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-medium leading-4 text-text-secondary">Code</span>
                        <textarea
                          value={aCode}
                          onChange={(e) => setACode(e.target.value)}
                          rows={4}
                          maxLength={20000}
                          placeholder="Your final solution."
                          className="mt-1 w-full rounded-md border border-hairline bg-well p-2.5 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong"
                        />
                      </label>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as ApproachVisibility)}
                      aria-label="Who can read this approach"
                      className="rounded-md border border-hairline bg-well px-2 py-2 text-sm text-text-primary"
                    >
                      <option value="private">Private</option>
                      <option value="squad">Squad</option>
                      <option value="public">Public</option>
                    </select>
                    <Button variant="primary" className="min-h-[44px]" loading={saving} disabled={!coreIdea.trim()}>
                      Save approach
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="card">
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
                <div className="card md:col-span-2">
                  <p className="text-sm leading-6 text-text-secondary">
                    Attempt the problem first. These tools respond to your work, they never hand over code.
                  </p>
                </div>
              )}
            </section>
          )}

          {review && (
            <Link
              href="/practice"
              className="card-interactive block rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-6"
            >
              <span className="font-medium text-text-primary">Review due: {review.reason.replace("_", " ")}</span>
              <span className="text-text-secondary"> — open your practice queue</span>
            </Link>
          )}

          <NextBattle surface="problem" />
        </div>

        {/* Rail */}
        <aside className="space-y-6">
          <section className="space-y-2" aria-label="Your squad on this problem">
            <h2 className="text-lg font-semibold leading-7 text-text-primary">Your squad on this problem</h2>
            <div className="card space-y-2">
              {squadActivity.length === 0 ? (
                <>
                  <div className="flex items-center gap-2.5 text-sm leading-6">
                    <Avatar name="Priya Nair" size="sm" />
                    <span className="flex-1 text-text-primary">Priya</span>
                    <span className="font-mono text-text-primary tnum">12:58</span>
                    <VerifiedBadge />
                  </div>
                  <div className="flex items-center gap-2.5 text-sm leading-6">
                    <Avatar name="Prem Sai" size="sm" />
                    <span className="flex-1 text-text-primary">You</span>
                    <span className="font-mono text-text-primary tnum">
                      {bestSec != null ? fmtDur(bestSec) : "15:06"}
                    </span>
                    <VerifiedBadge />
                  </div>
                  <div className="flex items-center gap-2.5 text-sm leading-6">
                    <Avatar name="Rahul Verma" size="sm" />
                    <span className="flex-1 text-text-primary">Rahul</span>
                    <span className="font-mono text-text-primary tnum">19:47</span>
                    <VerifiedBadge />
                  </div>
                  <div className="flex items-center gap-2.5 text-sm leading-6">
                    <Avatar name="Arjun Mehta" size="sm" />
                    <span className="flex-1 text-text-secondary">Arjun</span>
                    <span className="text-xs leading-4 text-text-tertiary">Attempted</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm leading-6">
                    <Avatar name="Sneha Iyer" size="sm" />
                    <span className="flex-1 text-text-secondary">Sneha</span>
                    <span className="text-xs leading-4 text-text-tertiary">Not yet</span>
                  </div>
                </>
              ) : (
                squadActivity.slice(0, 5).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2.5 text-sm leading-6">
                    <Avatar name="Member" size="sm" />
                    <span className="flex-1 truncate text-text-secondary">
                      {ev.kind} {ev.duration_sec != null ? `· ${fmtDur(ev.duration_sec)}` : ""}
                    </span>
                    <span className="font-mono text-xs text-text-tertiary tnum">
                      {new Date(ev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {challenges.length > 0 && (
            <section className="space-y-2" aria-label="Open challenges">
              <h2 className="text-lg font-semibold leading-7 text-text-primary">Open challenges</h2>
              {challenges.map((c) => (
                <Link
                  key={c.id}
                  href={`/c/${c.id}`}
                  className="card-interactive block min-h-[44px] rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-6"
                >
                  <span className="font-medium text-text-primary">@{c.from_profile?.username}</span>
                  <span className="text-text-secondary"> → @{c.to_profile?.username}</span>
                  {c.beat_time && c.sender_time_sec != null && (
                    <span className="font-mono text-text-secondary tnum"> · beat {fmtDur(c.sender_time_sec)}</span>
                  )}
                </Link>
              ))}
            </section>
          )}

          {primers.length > 0 && (
            <section className="space-y-2" aria-label="Learn first">
              <h2 className="text-lg font-semibold leading-7 text-text-primary">Learn first</h2>
              {primers.slice(0, 1).map((p) => (
                <Link
                  key={p.slug}
                  href={`/primers/${p.slug}`}
                  className="card-interactive block min-h-[44px] rounded-xl border border-hairline bg-surface px-4 py-3"
                >
                  <span className="block text-sm font-medium leading-5 text-text-primary">{p.title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-text-tertiary">Primer · read first</span>
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
