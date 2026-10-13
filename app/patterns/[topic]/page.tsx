"use client";

import { decodePathSegment } from "@/lib/pathSegment";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, Check, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { ErrorCard, EmptyState, Skeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { StatusGlyph } from "@/components/ui/ProblemRow";
import type { ProblemStatus } from "@/components/ui/ProblemRow";
import { getPrimersForPatterns } from "@/lib/data/primers";
import { getCatalogByTopic } from "@/lib/data/problems";
import { getApproachesForSlugs } from "@/lib/data/approaches";
import { getSharedResources } from "@/lib/data/vault";
import { getStuckRequestsForPattern } from "@/lib/data/stuck";
import { getSquadProblemStatuses } from "@/lib/data/sheets";
import { copyVaultToNotebook } from "@/lib/data/notebook";
import { TeacherList } from "@/components/profile/TeacherList";
import { dataErrorMessage } from "@/lib/data/errors";
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
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [asks, setAsks] = useState<StuckRequest[]>([]);
  const [vaultPicks, setVaultPicks] = useState<SharedResource[]>([]);
  const [ownStatus, setOwnStatus] = useState<Record<string, "solved" | "attempted">>({});
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
        // squad total, both from shared statuses. No join with verified
        // solves exists, so solved renders self-reported.
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
      })
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load this pattern hub.")))
      .finally(() => setLoading(false));
  }, [topic]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
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

  const mistakes = Array.from(
    new Set(approaches.map((a) => a.mistakes).filter(Boolean) as string[])
  ).slice(0, 5);

  const solvedStarters = starters.filter((s) => ownStatus[s.title_slug] === "solved").length;
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

  const shownApproaches = showAllApproaches ? approaches : approaches.slice(0, 3);
  const recognize = primer?.recognize_when?.[0];
  return (
    <div className="space-y-8">
      <nav
        aria-label="Breadcrumb"
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-tertiary md:min-h-0"
      >
        <Link href="/practice" className="transition-colors hover:text-text-primary">
          Practice
        </Link>
        <span aria-hidden>/</span>
        <Link href="/patterns" className="transition-colors hover:text-text-primary">
          Patterns
        </Link>
        <span aria-hidden>/</span>
        <span className="text-text-secondary">{topic}</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="type-display-md text-text-primary">{topic}</h1>
          <PatternChip label="Pattern" />
        </div>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-text-secondary">
          {recognize ?? `Starter problems and approaches for ${topic}.`}
        </p>
        {starters.length > 0 && (user || squadSolves != null) && (
          <p className="mt-1 font-mono text-xs text-text-tertiary tnum">
            {user && (
              <>You&apos;ve solved {solvedStarters} of {starters.length} starter problems</>
            )}
            {user && squadSolves != null && <> · </>}
            {squadSolves != null && <>squad {squadSolves} total</>}
          </p>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-hairline bg-surface px-4 py-2.5 text-xs leading-4 text-text-secondary">
          {notice}{" "}
          <Link href="/notebook" className="font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary">
            Open notebook
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
        {/* Focal: learning path */}
        <section aria-label="Learning path" className="card min-w-0 space-y-0 p-0">
          {primer ? (
            <>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-center gap-3">
                  <BookOpen className="h-5 w-5 shrink-0 text-pattern" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <Link
                      href={`/primers/${primer.slug}`}
                      className="block truncate text-[15px] font-medium leading-6 text-text-primary hover:underline"
                    >
                      {primer.title}
                    </Link>
                    <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
                      {primer.starter_slugs.length} starter problems
                    </p>
                  </div>
                </div>
                <Link
                  href={`/primers/${primer.slug}`}
                  className="inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
                >
                  Read primer
                </Link>
              </div>
              {starters.length > 0 && <div className="mx-4 border-t border-hairline sm:mx-6" />}
            </>
          ) : (
            <p className="px-4 pt-4 text-xs leading-4 text-text-tertiary sm:px-6 sm:pt-6">
              No primer yet for this pattern.
            </p>
          )}

          {starters.length === 0 ? (
            <p className="p-4 text-sm leading-6 text-text-secondary sm:p-6">
              No starters indexed for this pattern yet.
            </p>
          ) : allDone ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                heading="You've done all 6"
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
            <ol className="divide-y divide-hairline">
              {starters.map((s, i) => {
                const st = ownStatus[s.title_slug];
                const glyph: ProblemStatus = st === "solved" ? "self-reported" : st === "attempted" ? "attempted" : "none";
                const isNext = nextStarter?.title_slug === s.title_slug;
                return (
                  <li
                    key={s.title_slug}
                    className={cn(
                      "flex min-h-[48px] items-center gap-3 px-4 py-2.5 sm:px-6",
                      isNext && "bg-surface-raised/50"
                    )}
                  >
                    <span className="w-6 shrink-0 font-mono text-sm text-text-tertiary tnum">
                      {i + 1}
                    </span>
                    <StatusGlyph status={glyph} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/practice/${s.title_slug}`}
                        className="block truncate text-sm font-medium leading-5 text-text-primary hover:underline"
                      >
                        {s.title}
                      </Link>
                      <div className="mt-0.5">
                        <DifficultyBadgeNew difficulty={s.difficulty} />
                      </div>
                    </div>
                    {isNext ? (
                      <Button
                        variant="primary"
                        onClick={() => startBattle(s)}
                        className="min-h-[44px] shrink-0 md:min-h-0"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
                        Start battle
                      </Button>
                    ) : st === "solved" ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs leading-4 text-text-tertiary">
                        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Solved
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startBattle(s)}
                        aria-label={`Start ${s.title}`}
                        className="flex h-11 min-h-[44px] w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                      >
                        <Play className="h-4 w-4 fill-current" strokeWidth={1.5} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Rail */}
        <div className="min-w-0 space-y-8">
          {asks.length > 0 && (
            <section aria-labelledby="stuck-rail-heading" className="space-y-3">
              <h2 id="stuck-rail-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
                Where your squad is stuck
              </h2>
              <div className="space-y-2">
                {asks.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="flex min-h-[48px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5 text-text-primary">
                        {a.author?.username ? `@${a.author.username}` : "Someone"} is stuck on{" "}
                        {a.problem_slug.replace(/-/g, " ")}
                      </p>
                      <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
                        Wants {stuckLevelWant(a.level)}
                      </p>
                    </div>
                    <Link
                      href="/stuck"
                      className="inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
                    >
                      Help
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="teachers-heading" className="space-y-3">
            <h2 id="teachers-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
              Who teaches this well
            </h2>
            <TeacherList pattern={topic} />
          </section>
        </div>
      </div>

      {(mistakes.length > 0 || vaultPicks.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {mistakes.length > 0 && (
            <section aria-labelledby="mistakes-heading" className="card space-y-2">
              <h2 id="mistakes-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
                Common mistakes
              </h2>
              <ul className="space-y-1.5">
                {mistakes.map((m, i) => (
                  <li key={i} className="text-sm leading-6 text-text-secondary">
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {vaultPicks.length > 0 && (
            <section aria-labelledby="vault-heading" className="card space-y-2">
              <h2 id="vault-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
                From the vault
              </h2>
              <ul className="space-y-2">
                {vaultPicks.map((r) => (
                  <li
                    key={r.id}
                    className="flex min-h-[48px] items-center gap-3 rounded-lg border border-hairline bg-well px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5 text-text-primary">
                        {r.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-text-tertiary">
                        {r.category} · @{r.author_profile?.username ?? "vault"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyVault(r.id)}
                      disabled={copyingId === r.id}
                      className="inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 md:min-h-0"
                    >
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
        <section aria-labelledby="community-heading" className="space-y-3">
          <h2 id="community-heading" className="text-[18px] font-semibold leading-[26px] text-text-primary">
            Community approaches
          </h2>
          <div className="space-y-2">
            {shownApproaches.map((a) => (
              <Link
                key={a.id}
                href={`/practice/${a.problem_slug}`}
                className="card-interactive block rounded-xl border border-hairline bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-text-tertiary">
                    @{a.author?.username ?? "squad"}
                  </span>
                  <span className="text-xs leading-4 text-text-tertiary">·</span>
                  <span className="truncate text-xs leading-4 text-text-secondary">
                    {a.problem_slug.replace(/-/g, " ")}
                  </span>
                  {a.pattern && <PatternChip label={a.pattern} />}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">
                  {a.core_idea}
                </p>
              </Link>
            ))}
          </div>
          {approaches.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllApproaches((v) => !v)}
              className="inline-flex h-10 min-h-[44px] items-center gap-1 rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
            >
              {showAllApproaches ? "Show less" : `See all ${approaches.length}`}
              <ChevronRight
                className={cn("h-4 w-4 transition-transform duration-200", showAllApproaches && "rotate-90")}
                strokeWidth={1.5}
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
