"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, ArrowLeft, Copy, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { difficultyBadgeClass } from "@/components/ui/DifficultyBadge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getPrimersForPatterns } from "@/lib/data/primers";
import { setProblemStatus } from "@/lib/data/sheets";
import { getProblemTimeline, logProblemEvent } from "@/lib/data/problemEvents";
import { getBattlesForSlug } from "@/lib/data/battles";
import { getChallengesForSlug } from "@/lib/data/suggestions";
import { toggleBookmark, isBookmarked, getReviewForSlug } from "@/lib/data/review";
import { getApproachesForProblem, createApproach, setApproachVisibility, deleteApproach } from "@/lib/data/approaches";
import { copyApproachToNotebook } from "@/lib/data/notebook";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { Problem, ProblemEvent, ProblemEventKind, Approach, ApproachVisibility, Primer, Battle, Suggestion, ReviewItem, TriState } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const KIND_LABEL: Record<ProblemEventKind, { label: string; cls: string }> = {
  solved: { label: "Solved", cls: "bg-[#30d158]/15 text-[#30d158] border-[#30d158]/30" },
  attempted: { label: "Attempted", cls: "bg-[#ff9f0a]/15 text-[#ff9f0a] border-[#ff9f0a]/30" },
  explained: { label: "Explained", cls: "bg-[#0a84ff]/15 text-[#0a84ff] border-[#0a84ff]/30" },
  revisited: { label: "Revisited", cls: "bg-[#bf5af2]/15 text-[#bf5af2] border-[#bf5af2]/30" },
  challenge_completed: { label: "Challenge completed", cls: "bg-[#30d158]/15 text-[#30d158] border-[#30d158]/30" },
  failed: { label: "Failed", cls: "bg-[#ff453a]/15 text-[#ff453a] border-[#ff453a]/30" },
  stuck: { label: "Stuck", cls: "bg-white/[0.06] text-white/60 border-white/[0.1]" },
};

function fmtDur(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

  const [coreIdea, setCoreIdea] = useState("");
  // Full approach fields (plan Step 9): the columns existed and were never
  // collected, so a shared approach was always a truncated paragraph.
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
      <div role="alert" className="p-12 text-center space-y-3">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <button onClick={load} className="px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }

  const title = problem?.title ?? slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="space-y-8 select-none max-w-3xl">
      <Link href="/practice" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Practice</span>
      </Link>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {problem && (
            <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", difficultyBadgeClass(problem.difficulty))}>
              {problem.difficulty}
            </span>
          )}
          {(problem?.topics ?? []).slice(0, 3).map((t) => (
            <Link key={t} href={`/patterns/${encodeURIComponent(t)}`}
              className="px-2.5 py-0.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] text-white/60 hover:text-white transition-all">
              {t} →
            </Link>
          ))}
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">{title}</h1>
        <p className="text-[11px] text-white/40 mt-1">
          {status === "solved" ? "Solved — now explain it, challenge someone, or revisit it." : status === "attempted" ? "Attempted — finish the battle." : "Unattempted — start your first battle."}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => problem && startSolving({ id: problem.question_id || slug, title, slug, difficulty: problem.difficulty || "Medium", category: problem.topics?.[0] || "General" })}
          className="px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 font-bold text-xs flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{status === "solved" ? "Battle again" : "Start battle"}</span>
        </button>
        <ProblemLink slug={slug} className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 border border-white/[0.08]" />
        {user && status !== "solved" && (
          <button onClick={() => handleStatus("solved")} className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-bold cursor-pointer">
            Mark solved
          </button>
        )}
        {user && status !== "attempted" && status !== "solved" && (
          <button onClick={() => handleStatus("attempted")} className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/70 text-xs font-bold cursor-pointer">
            Mark attempted
          </button>
        )}
        <Link href="/challenges" className="px-4 py-2 rounded-full bg-[#fa586a]/15 hover:bg-[#fa586a]/25 border border-[#fa586a]/30 text-[#fa586a] text-xs font-bold transition-all">
          Challenge someone
        </Link>
        {user && (
          <button
            onClick={async () => setBookmarked(await toggleBookmark(slug))}
            className={cn("px-4 py-2 rounded-full border text-xs font-bold transition-all cursor-pointer",
              bookmarked
                ? "bg-[#ffd60a]/15 border-[#ffd60a]/40 text-[#ffd60a]"
                : "bg-white/[0.06] border-white/[0.08] text-white/60 hover:text-white")}
            title="Bookmark for revision"
          >
            {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
          </button>
        )}
      </div>

      {/* ── Before: learn the pattern (Bible §14) ── */}      {primers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white">Learn first <span className="text-white/30 font-normal text-[11px]">· before solving</span></h2>
          {primers.slice(0, 2).map((p) => (
            <Link key={p.slug} href={`/primers/${p.slug}`}
              className="block p-4 rounded-2xl bg-[#0a84ff]/[0.06] hover:bg-[#0a84ff]/[0.1] border border-[#0a84ff]/25 transition-all">
              <div className="text-[10px] font-bold text-[#0a84ff] uppercase tracking-widest">{p.pattern} primer</div>
              <div className="text-xs font-bold text-white mt-0.5">{p.title} →</div>
            </Link>
          ))}
        </section>
      )}

      {/* ── History timeline (Bible §48) ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">Your history</h2>
        {timeline.length === 0 ? (
          <p className="text-xs text-white/30 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            No battles recorded yet. Your attempts, solves, revisits, and explanations will form a timeline here — not just a green checkbox.
          </p>
        ) : (
          <div className="space-y-2">
            {timeline.map((ev) => {
              const k = KIND_LABEL[ev.kind];
              const source = (ev.metadata as { source?: string })?.source;
              return (
                <div key={ev.id} className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs flex-wrap">
                  <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold", k.cls)}>{k.label}</span>
                  <span className="text-white/40 font-mono">{new Date(ev.created_at).toLocaleDateString()}</span>
                  {ev.duration_sec != null && <span className="text-white/60 font-mono">{fmtDur(ev.duration_sec)}</span>}
                  <span className="text-[10px] text-white/30" title="Verified solve = LeetCode evidence supports the event. Self-reported = you marked it. Neither proves learning — explanations and reattempts do.">
                    {source === "leetcode" ? "· LeetCode evidence" : "· Self-reported"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Approaches (After solving — Bible §13) ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">Approaches <span className="text-white/30 font-normal text-[11px]">· after solving — what worked</span></h2>
        {approaches.length === 0 ? (
          <p className="text-xs text-white/30 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            No approaches yet. After you solve, write the core idea — your future self and your squad will thank you.
          </p>
        ) : (
          <div className="space-y-2">
            {approaches.map((a) => (
              <div key={a.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">@{a.author?.username || "you"}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 uppercase">{a.visibility}</span>
                    <button
                      onClick={async () => {
                        if (await copyText(a.core_idea)) {
                          setCopiedId(a.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }
                      }}
                      className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer" title="Copy approach"
                    >
                      {copiedId === a.id ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await copyApproachToNotebook(a.id);
                          setCopiedId(`nb-${a.id}`);
                          setTimeout(() => setCopiedId(null), 2000);
                        } catch {
                          // logged-out users can't copy; clipboard above still works
                        }
                      }}
                      className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 hover:text-white text-[10px] font-bold cursor-pointer"
                      title="Copy to my notebook (private, with attribution)"
                    >
                      {copiedId === `nb-${a.id}` ? "Saved!" : "Notebook+"}
                    </button>
                    {a.user_id === user?.id && (
                      <button onClick={async () => { await deleteApproach(a.id); setApproaches(await getApproachesForProblem(slug).catch(() => [])); }}
                        className="p-1.5 rounded-full text-white/30 hover:text-[#ff453a] cursor-pointer" title="Delete approach">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">{a.core_idea}</p>
                {(a.complexity_time || a.complexity_space) && (
                  <p className="text-[11px] text-white/40 font-mono">{a.complexity_time || "?"} · {a.complexity_space || "?"}</p>
                )}
                {(a.key_detail || a.edge_cases || a.mistakes || a.code) && (
                  <p className="text-[11px] text-white/35">
                    Has full detail — key cases, mistakes and code.
                  </p>
                )}
                <Link
                  href={`/approach/${a.id}`}
                  className="inline-block text-[11px] font-bold text-[#0a84ff] hover:underline"
                >
                  Read full approach →
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
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-white cursor-pointer"
                    title="Sharing is intentional and reversible"
                  >
                    <option value="private">Private</option>
                    <option value="squad">Squad</option>
                    <option value="public">Public</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        {user && status === "solved" && (
          <form onSubmit={handleSaveApproach} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
            <div className="text-xs font-bold text-white">Explain your approach</div>
            {formError && <div className="text-xs text-[#ff453a]">{formError}</div>}
            <textarea value={coreIdea} onChange={(e) => setCoreIdea(e.target.value)} rows={3} maxLength={5000}
              placeholder="Core idea in 2–4 sentences. What was the key insight?"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 resize-y" />

            {/* Everything below is optional. Core idea alone is a complete approach;
                the rest is what makes it teachable to somebody else. */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-bold text-white/50 hover:text-white cursor-pointer"
            >
              {expanded ? "− Fewer details" : "+ Add complexity, key detail, edge cases, mistakes, code"}
            </button>

            {expanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Pattern</span>
                  <input value={aPattern} onChange={(e) => setAPattern(e.target.value)} maxLength={80}
                    placeholder="e.g. Two Pointers"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Time</span>
                  <input value={aTime} onChange={(e) => setATime(e.target.value)} maxLength={40}
                    placeholder="e.g. O(n)"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Space</span>
                  <input value={aSpace} onChange={(e) => setASpace(e.target.value)} maxLength={40}
                    placeholder="e.g. O(1)"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Key detail</span>
                  <input value={aKeyDetail} onChange={(e) => setAKeyDetail(e.target.value)} maxLength={500}
                    placeholder="The one thing that makes it work"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Edge cases</span>
                  <input value={aEdgeCases} onChange={(e) => setAEdgeCases(e.target.value)} maxLength={1000}
                    placeholder="Empty input, duplicates, single element…"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Mistakes</span>
                  <input value={aMistakes} onChange={(e) => setAMistakes(e.target.value)} maxLength={1000}
                    placeholder="What you got wrong first"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Code (20k max)</span>
                  <textarea value={aCode} onChange={(e) => setACode(e.target.value)} rows={4} maxLength={20000}
                    placeholder="Your final solution. Blurred for readers until they reveal it."
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 resize-y" />
                </label>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as ApproachVisibility)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white cursor-pointer">
                <option value="private">Private (default)</option>
                <option value="squad">Squad</option>
                <option value="public">Public</option>
              </select>
              <button type="submit" disabled={saving || !coreIdea.trim()}
                className="px-4 py-1.5 rounded-full bg-[#fa586a] text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer">
                {saving ? "Saving…" : "Save approach"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── Review state (Bible §25) ── */}
      {review && (
        <Link href="/practice"
          className="block p-4 rounded-2xl bg-[#ff9f0a]/[0.07] hover:bg-[#ff9f0a]/[0.12] border border-[#ff9f0a]/30 transition-all text-xs">
          <span className="font-bold text-[#ff9f0a]">Review due: {review.reason.replace("_", " ")}</span>
          <span className="text-white/50"> — open your practice queue →</span>
        </Link>
      )}

      {/* ── Your attempts (During — Bible §15) ── */}
      {battles.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white">Your attempts <span className="text-white/30 font-normal text-[11px]">· private sessions</span></h2>
          {battles.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs flex-wrap">
              <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold",
                b.outcome === "solved" ? "bg-[#30d158]/15 text-[#30d158] border-[#30d158]/30"
                : b.outcome === "failed" ? "bg-[#ff453a]/15 text-[#ff453a] border-[#ff453a]/30"
                : "bg-white/[0.05] text-white/50 border-white/[0.1]")}>
                {b.outcome}
              </span>
              <span className="text-white/40 font-mono">{new Date(b.started_at).toLocaleDateString()}</span>
              {b.duration_sec != null && <span className="text-white/60 font-mono">{fmtDur(b.duration_sec)}</span>}
              {b.evidence === "leetcode" && <span className="text-[10px] text-white/30">· LeetCode evidence</span>}
            </div>
          ))}
        </section>
      )}

      {/* ── Open challenges on this problem ── */}
      {challenges.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white">Open challenges</h2>
          {challenges.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`}
              className="block p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] text-xs transition-all">
              <span className="font-bold text-white">@{c.from_profile?.username}</span>
              <span className="text-white/50"> → @{c.to_profile?.username}</span>
              {c.beat_time && c.sender_time_sec != null && (
                <span className="text-[#0a84ff] font-mono"> · beat {fmtDur(c.sender_time_sec)}</span>
              )}
              <span className="text-white/30"> →</span>
            </Link>
          ))}
        </section>
      )}

      {/* ── Recent activity on this problem ── */}
      {squadActivity.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white">Recent activity</h2>
          <div className="space-y-2">
            {squadActivity.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px] text-white/50">
                <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold", KIND_LABEL[ev.kind].cls)}>{KIND_LABEL[ev.kind].label}</span>
                <span className="font-mono">{new Date(ev.created_at).toLocaleDateString()}</span>
                {ev.duration_sec != null && <span className="font-mono">{fmtDur(ev.duration_sec)}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
