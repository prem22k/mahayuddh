"use client";

import { decodePathSegment } from "@/lib/pathSegment";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen, Bookmark, Copy, Send, Swords, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { ErrorCard, EmptyState, Skeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip, SelfReportedBadge, VerifiedBadge } from "@/components/ui/Badge";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import type { ProblemStatus } from "@/components/ui/ProblemRow";
import { SplitBar } from "@/components/matrix/SplitBar";
import { getPrimersForPatterns } from "@/lib/data/primers";
import { getCatalogByTopic } from "@/lib/data/problems";
import { getApproachesForSlugs } from "@/lib/data/approaches";
import { getSharedResources } from "@/lib/data/vault";
import { getStuckRequestsForPattern } from "@/lib/data/stuck";
import { getSquadProblemStatuses } from "@/lib/data/sheets";
import { getVerifiedSolvers } from "@/lib/data/squadActivity";
import { copyVaultToNotebook } from "@/lib/data/notebook";
import { TeacherList } from "@/components/profile/TeacherList";
import { dataErrorMessage } from "@/lib/data/errors";
import { daysBetween, relativeDays, titleFromSlug } from "@/lib/format";
import { Primer, Problem, Approach, SharedResource, StuckRequest, StuckLevel } from "@/types/database";

// Pattern hub (08): primer + ordered starters + stuck rail + teachers +
// mistakes + vault + community approaches. All projections over existing tables.
export default function PatternPage() {
  const params = useParams<{ topic: string }>();
  const topic = decodePathSegment(params.topic);
  const { startSolving } = useSolving();
  const { user } = useAuth();

  const [primer, setPrimer] = useState<Primer | null>(null);
  const [starters, setStarters] = useState<Problem[]>([]);
  const [catalogBySlug, setCatalogBySlug] = useState<Map<string, Problem>>(new Map());
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [asks, setAsks] = useState<StuckRequest[]>([]);
  const [vaultPicks, setVaultPicks] = useState<SharedResource[]>([]);
  const [ownStatus, setOwnStatus] = useState<Record<string, "solved" | "attempted">>({});
  const [ownVerified, setOwnVerified] = useState<Record<string, boolean>>({});
  const [squadSolves, setSquadSolves] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [showAllApproaches, setShowAllApproaches] = useState(false);

  useEffect(() => {
    if (!topic) return;
    Promise.all([
      getPrimersForPatterns([topic]).catch(() => []),
      getCatalogByTopic(topic, 30).catch(() => []),
      getSharedResources().catch(() => []),
    ])
      .then(async ([primers, catalog, vault]) => {
        const p = primers[0] ?? null;
        setPrimer(p);
        const starterSlugs = p?.starter_slugs?.length ? p.starter_slugs : catalog.slice(0, 3).map((c) => c.title_slug);
        const bySlug = new Map(catalog.map((c) => [c.title_slug, c]));
        setCatalogBySlug(bySlug);
        const ordered = starterSlugs.slice(0, 6).map(
          (s) =>
            bySlug.get(s) ?? {
              title_slug: s,
              title: s.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" "),
              difficulty: "Medium" as Problem["difficulty"],
              question_id: s,
              paid_only: false,
              topics: [topic],
              updated_at: new Date().toISOString(),
            }
        );
        setStarters(ordered);
        const pool = Array.from(new Set([...starterSlugs, ...catalog.slice(0, 30).map((c) => c.title_slug)]));
        setApproaches(await getApproachesForSlugs(pool, 10).catch(() => []));
        const t = topic.toLowerCase();

        // Open "I'm stuck" asks on this pattern's problems. Fetched with
        // everything else and never allowed to fail the page.
        getStuckRequestsForPattern(pool.slice(0, 40))
          .then(setAsks)
          .catch(() => setAsks([]));

        setVaultPicks(
          vault.filter(
            (r) => r.title.toLowerCase().includes(t) || r.content.toLowerCase().includes(t)
          ).slice(0, 3)
        );

        // Honest progress over the starter list: your own marks plus the
        // squad total, both from shared statuses.
        getSquadProblemStatuses(ordered.map((s) => s.title_slug))
          .then((rows) => {
            const mine: Record<string, "solved" | "attempted"> = {};
            const pairs = new Set<string>();
            for (const r of rows) {
              if (user && r.user_id === user.id && (r.status === "solved" || r.status === "attempted")) {
                mine[r.problem_slug] = r.status;
              }
              if (r.status === "solved") pairs.add(`${r.user_id}:${r.problem_slug}`);
            }
            setOwnStatus(mine);
            setSquadSolves(pairs.size);
          })
          .catch(() => {
            setOwnStatus({});
            setSquadSolves(null);
          });

        // Verified overlay: LeetCode-sourced solve events for the viewer. A
        // failed read keeps every solved starter self-reported, never emerald.
        if (user) {
          getVerifiedSolvers(ordered.map((s) => s.title_slug), [user.id])
            .then((map) => {
              const rec: Record<string, boolean> = {};
              for (const [slug, set] of map) if (set.has(user.id)) rec[slug] = true;
              setOwnVerified(rec);
            })
            .catch(() => setOwnVerified({}));
        }
      })
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load this pattern hub.")))
      .finally(() => setLoading(false));
  }, [topic]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-8" aria-hidden>
        <div className="space-y-3">
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 w-full rounded-lg lg:col-span-8" />
          <Skeleton className="h-64 w-full rounded-lg lg:col-span-4" />
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="max-w-2xl">
        <ErrorCard message={loadError} />
      </div>
    );
  }

  // Primer mistakes lead (they are curated); approach write-ups fill in.
  const mistakes = Array.from(
    new Set(
      [...(primer?.mistakes ?? []), ...approaches.map((a) => a.mistakes)]
        .map((m) => m?.trim())
        .filter(Boolean) as string[]
    )
  ).slice(0, 5);

  const solvedStarters = starters.filter((s) => ownStatus[s.title_slug] === "solved").length;
  const verifiedStarters = starters.filter(
    (s) => ownStatus[s.title_slug] === "solved" && ownVerified[s.title_slug]
  ).length;
  const nextStarter = starters.find((s) => ownStatus[s.title_slug] !== "solved") ?? null;
  const allDone = starters.length > 0 && solvedStarters === starters.length;

  const startBattle = (s: Problem) => {
    startSolving({
      id: s.question_id || s.title_slug,
      title: s.title,
      slug: s.title_slug,
      difficulty: s.difficulty,
      category: topic,
    });
  };

  const copyVault = async (id: string) => {
    setCopyingId(id);
    setNotice(null);
    try {
      await copyVaultToNotebook(id);
      setNotice("Copied to your notebook.");
    } catch {
      setNotice("Couldn't copy that. Try again.");
    } finally {
      setCopyingId(null);
    }
  };

  const titleOf = (slug: string) =>
    starters.find((s) => s.title_slug === slug)?.title ?? catalogBySlug.get(slug)?.title ?? titleFromSlug(slug);
  const difficultyOf = (slug: string) =>
    starters.find((s) => s.title_slug === slug)?.difficulty ?? catalogBySlug.get(slug)?.difficulty ?? null;

  const shownApproaches = showAllApproaches ? approaches : approaches.slice(0, 3);
  const recognize = primer?.recognize_when?.[0];
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <nav
        aria-label="Breadcrumb"
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-tertiary md:min-h-0"
      >
        <Link href="/practice" className="transition-colors hover:text-text-primary">
          Practice
        </Link>
        <span aria-hidden className="text-text-disabled">/</span>
        <Link href="/patterns" className="transition-colors hover:text-text-primary">
          Patterns
        </Link>
        <span aria-hidden className="text-text-disabled">/</span>
        <span className="truncate text-text-secondary">{topic}</span>
      </nav>

      {/* Heading */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-display-md text-text-primary">{topic}</h1>
          <PatternChip
            label="Pattern"
            className="h-6 border border-pattern/30 font-mono text-xs uppercase tracking-[0.06em]"
          />
        </div>
        <p className="max-w-3xl text-[15px] leading-6 text-text-secondary md:text-[17px] md:leading-7">
          {recognize ?? `Starter problems and approaches for ${topic}.`}
        </p>
        {starters.length > 0 && (user || squadSolves != null) && (
          <div className="mt-1 flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 md:border-0 md:bg-transparent md:p-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium leading-4 text-text-secondary">
              {user && (
                <span>
                  <span className="font-mono text-text-primary tnum">
                    {solvedStarters} of {starters.length}
                  </span>{" "}
                  starter problems solved
                </span>
              )}
              {user && squadSolves != null && <span className="text-text-disabled" aria-hidden>·</span>}
              {squadSolves != null && (
                <span className="font-mono text-text-tertiary tnum">squad {squadSolves} total</span>
              )}
            </p>
            {user && (
              <SplitBar
                total={starters.length}
                verified={verifiedStarters}
                selfReported={solvedStarters - verifiedStarters}
                label="Starter problems solved"
                className="h-1.5 sm:w-64"
              />
            )}
          </div>
        )}
      </section>

      {notice && (
        <p role="status" className="rounded-lg border border-hairline bg-surface px-4 py-2.5 text-xs leading-4 text-text-secondary">
          {notice}{" "}
          <Link href="/notebook" className="font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary">
            Open notebook
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Focal: learning path */}
        <section
          aria-label="Learning path"
          className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface lg:col-span-8"
        >
          {primer ? (
            <div className="flex items-center justify-between gap-3 bg-surface-raised/30 p-3.5 md:gap-4 md:p-6">
              <div className="flex min-w-0 items-center gap-3 md:gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-pattern/20 bg-pattern-tint">
                  <BookOpen className="h-5 w-5 text-pattern" strokeWidth={1.5} aria-hidden />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/primers/${primer.slug}`}
                    className="block truncate text-[15px] font-semibold leading-6 tracking-[-0.01em] text-text-primary hover:underline md:text-lg md:leading-[26px]"
                  >
                    {primer.title}
                  </Link>
                  <p className="text-xs font-medium leading-4 text-text-tertiary">
                    Primer · {primer.starter_slugs.length} starter problems
                  </p>
                </div>
              </div>
              <Link
                href={`/primers/${primer.slug}`}
                className="inline-flex h-9 min-h-[44px] shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-raised px-3 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-overlay md:min-h-0 md:px-4"
              >
                Read primer
              </Link>
            </div>
          ) : (
            <p className="bg-surface-raised/30 px-4 py-4 text-xs leading-4 text-text-tertiary md:px-6">
              No primer yet for this pattern.
            </p>
          )}

          {starters.length > 0 && (
            <div className="flex items-center justify-between border-y border-hairline px-4 py-2 font-mono text-[11px] font-medium tracking-[0.06em] text-text-tertiary md:hidden">
              <span>STARTER SEQUENCE ({starters.length})</span>
            </div>
          )}

          {starters.length === 0 ? (
            <p className="border-t border-hairline p-4 text-sm leading-6 text-text-secondary md:p-6">
              No starters indexed for this pattern yet.
            </p>
          ) : allDone ? (
            <div className="border-t border-hairline p-4 md:p-6">
              <EmptyState
                heading={`You've done all ${starters.length}`}
                body="Try one from the community list or take revenge on a failed one."
                action={
                  <Link
                    href="/practice"
                    className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
                  >
                    See review queue
                  </Link>
                }
              />
            </div>
          ) : (
            <ol className="divide-y divide-hairline md:border-t md:border-hairline">
              {starters.map((s, i) => {
                const st = ownStatus[s.title_slug];
                const verified = st === "solved" && Boolean(ownVerified[s.title_slug]);
                const glyph: ProblemStatus =
                  st === "solved" ? (verified ? "verified" : "self-reported") : st === "attempted" ? "attempted" : "none";
                const isNext = nextStarter?.title_slug === s.title_slug;
                return (
                  <li
                    key={s.title_slug}
                    className={cn(
                      "group relative flex min-h-14 flex-wrap items-center gap-x-3 gap-y-3 px-4 py-2.5 md:flex-nowrap md:gap-4 md:px-6 md:py-2",
                      isNext ? "bg-primary-tint/25" : "transition-colors hover:bg-surface-raised/40"
                    )}
                  >
                    {isNext && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
                    <span className="md:hidden">
                      <StatusGlyph status={glyph} />
                    </span>
                    <span
                      className={cn(
                        "hidden w-5 shrink-0 font-mono text-xs font-medium tnum md:block",
                        isNext ? "font-semibold text-primary" : "text-text-tertiary"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
                      <Link
                        href={`/practice/${s.title_slug}`}
                        className={cn(
                          "block min-w-0 truncate text-sm font-medium leading-5 transition-colors hover:underline",
                          st || isNext ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                        )}
                      >
                        <span className="font-mono text-text-tertiary md:hidden">{i + 1}. </span>
                        {s.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 md:mt-0 md:contents">
                        <DifficultyBadgeNew difficulty={s.difficulty} size="sm" />
                        {isNext && (
                          <span className="inline-flex h-5 items-center rounded-xs border border-primary/20 bg-primary-tint px-2 font-mono text-[11px] font-medium text-primary">
                            Next up
                          </span>
                        )}
                        {st && (
                          <span className="text-[11px] leading-4 text-text-tertiary md:hidden">
                            {st === "solved" ? (verified ? "Verified" : "Self-reported") : "Attempted"}
                          </span>
                        )}
                      </div>
                    </div>

                    {isNext ? (
                      <div className="basis-full md:shrink-0 md:basis-auto">
                        <Button
                          variant="primary"
                          onClick={() => startBattle(s)}
                          className="min-h-[44px] w-full font-semibold md:min-h-0 md:w-auto"
                        >
                          <Swords className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
                          Start battle
                        </Button>
                      </div>
                    ) : st === "solved" ? (
                      verified ? (
                        <VerifiedBadge className="hidden shrink-0 md:inline-flex" />
                      ) : (
                        <SelfReportedBadge className="hidden shrink-0 md:inline-flex" />
                      )
                    ) : st === "attempted" ? (
                      <button
                        type="button"
                        onClick={() => startBattle(s)}
                        className="inline-flex h-8 min-h-[44px] shrink-0 items-center rounded-xs border border-hairline bg-surface-raised px-2.5 text-xs font-medium leading-4 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-8"
                      >
                        Resume
                      </button>
                    ) : (
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="hidden md:inline-flex">
                          <StatusGlyph status="none" />
                        </span>
                        <button
                          type="button"
                          onClick={() => startBattle(s)}
                          aria-label={`Start ${s.title}`}
                          className="inline-flex h-8 min-h-[44px] items-center rounded-xs border border-hairline bg-surface-raised px-2.5 text-xs font-medium leading-4 text-text-secondary transition-[color,background-color,opacity] hover:bg-surface-overlay hover:text-text-primary md:min-h-8 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                        >
                          Start
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Rail */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <section
            aria-labelledby="stuck-rail-heading"
            className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4"
          >
            <h2
              id="stuck-rail-heading"
              className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
            >
              Where your squad is stuck
            </h2>
            {asks.length === 0 ? (
              <p className="text-xs leading-4 text-text-tertiary">
                Nobody has an open ask on this pattern&apos;s problems.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {asks.slice(0, 3).map((a) => {
                  // Anonymous asks never show who is stuck.
                  const who = a.visibility === "anon" ? null : a.author?.username ?? null;
                  const difficulty = difficultyOf(a.problem_slug);
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-raised p-3"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          name={who ?? "Someone"}
                          src={who ? a.author?.avatar_url : null}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug text-text-primary">
                            {who ? `@${who}` : "Someone"} is stuck on {titleOf(a.problem_slug)}
                          </p>
                          <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
                            wants {stuckLevelWant(a.level)} · {relativeDays(daysBetween(a.created_at))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-text-disabled">
                          {difficulty ?? ""}
                        </span>
                        <Link
                          href="/stuck"
                          className="inline-flex h-8 min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-3 text-xs font-medium leading-4 text-text-primary transition-colors hover:bg-[#272830] md:min-h-8"
                        >
                          <Send className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden />
                          Help
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section
            aria-labelledby="teachers-heading"
            className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4"
          >
            <h2
              id="teachers-heading"
              className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
            >
              Who teaches this well
            </h2>
            <TeacherList pattern={topic} />
          </section>
        </div>
      </div>

      {(mistakes.length > 0 || vaultPicks.length > 0) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {mistakes.length > 0 && (
            <section
              aria-labelledby="mistakes-heading"
              className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-6"
            >
              <h2
                id="mistakes-heading"
                className="flex items-center gap-2 text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
              >
                <TriangleAlert className="h-[18px] w-[18px] text-error" strokeWidth={1.5} aria-hidden />
                Common mistakes
              </h2>
              <ul className="flex flex-col divide-y divide-hairline">
                {mistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-3 py-3 text-[15px] leading-6 text-text-secondary first:pt-0 last:pb-0">
                    <span className="mt-1 shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-disabled tnum">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {vaultPicks.length > 0 && (
            <section
              aria-labelledby="vault-heading"
              className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-6"
            >
              <h2
                id="vault-heading"
                className="flex items-center gap-2 text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
              >
                <Bookmark className="h-[18px] w-[18px] text-pattern" strokeWidth={1.5} aria-hidden />
                From the vault
              </h2>
              <ul className="flex flex-col gap-4">
                {vaultPicks.map((r) => (
                  <li key={r.id} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-raised p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm font-medium leading-5 text-text-primary">{r.title}</p>
                        <span className="shrink-0 rounded-xs bg-pattern-tint px-2 py-0.5 font-mono text-[11px] font-medium text-pattern">
                          {r.category}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-4 text-text-tertiary">
                        by @{r.author_profile?.username ?? "vault"}
                      </p>
                      {r.content.trim() && (
                        <pre className="mt-1 whitespace-pre-wrap break-words rounded-xs border border-hairline bg-well p-2.5 font-mono text-xs leading-[18px] text-text-secondary">
                          <span className="line-clamp-4">{r.content.trim()}</span>
                        </pre>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyVault(r.id)}
                      disabled={copyingId === r.id}
                      className="flex h-9 min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-hairline bg-surface-overlay text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] disabled:opacity-50 md:min-h-9"
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      {copyingId === r.id ? "Copying" : "Copy to my notebook"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {approaches.length > 0 && (
        <section aria-labelledby="community-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="community-heading"
              className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
            >
              Community approaches
            </h2>
            <span className="text-xs font-medium leading-4 text-text-tertiary tnum">
              {approaches.length} write-up{approaches.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {shownApproaches.map((a) => {
              const handle = a.author?.username ?? null;
              return (
                <Link
                  key={a.id}
                  href={`/practice/${a.problem_slug}`}
                  className="flex flex-col justify-between gap-4 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={handle ?? "Squad"} src={a.author?.avatar_url} size="sm" />
                      <span className="truncate text-sm font-medium leading-5 text-text-primary">
                        @{handle ?? "squad"}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs font-medium leading-4 text-text-secondary">
                      {titleOf(a.problem_slug)}
                    </p>
                    <p className="rounded-xs border border-hairline bg-surface-raised/40 p-2.5 text-xs leading-5 text-text-secondary">
                      <span className="line-clamp-4">&ldquo;{a.core_idea}&rdquo;</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2 font-mono text-xs font-medium">
                    {a.pattern ? (
                      <span className="truncate rounded-xs bg-pattern-tint px-1.5 py-0.5 text-[11px] text-pattern">
                        {a.pattern}
                      </span>
                    ) : (
                      <span />
                    )}
                    {a.complexity_time && (
                      <span className="shrink-0 text-text-secondary">{a.complexity_time}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          {approaches.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllApproaches((v) => !v)}
              className="group inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
            >
              {showAllApproaches ? "Show fewer" : `See all ${approaches.length} community approaches`}
              <ArrowRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  showAllApproaches ? "-rotate-90" : "group-hover:translate-x-1"
                )}
                strokeWidth={1.5}
                aria-hidden
              />
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function stuckLevelWant(level: StuckLevel): string {
  switch (level) {
    case "nudge":
      return "a nudge";
    case "pattern":
      return "a pattern hint";
    case "direction":
      return "direction";
    case "full":
      return "a full explanation";
  }
}
