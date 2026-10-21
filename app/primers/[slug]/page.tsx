"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Check, Clock, Copy, Gauge, ListChecks, Swords, TriangleAlert } from "lucide-react";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { PatternChip, DifficultyBadgeNew, SelfReportedBadge } from "@/components/ui/Badge";
import { StatusGlyph, type ProblemStatus } from "@/components/ui/ProblemRow";
import { CodeBlock } from "@/components/approach/CodeBlock";
import { InlineText } from "@/components/notebook/RichText";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { getPrimer, primerReadMinutes } from "@/lib/data/primers";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getUserStatusesBySlugs } from "@/lib/data/sheets";
import { copyPrimerToNotebook } from "@/lib/data/notebook";
import { track } from "@/lib/analytics";
import { Primer, Problem } from "@/types/database";
import { cn } from "@/lib/utils";

/** A starter row; `inCatalog` false means the slug has no catalog row, so no number or difficulty is shown. */
type Starter = Omit<Problem, "difficulty"> & { difficulty: Problem["difficulty"] | ""; inCatalog: boolean };

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const TOC = [
  { id: "recognize", label: "Recognize it when" },
  { id: "mental-model", label: "Mental model" },
  { id: "template", label: "Template" },
  { id: "complexity", label: "Complexity" },
  { id: "mistakes", label: "Common mistakes" },
  { id: "starters", label: "Starter problems" },
] as const;

export default function PrimerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const { startSolving } = useSolving();
  const { user } = useAuth();
  const [primer, setPrimer] = useState<Primer | null>(null);
  const [starters, setStarters] = useState<Starter[]>([]);
  const [statusBySlug, setStatusBySlug] = useState<Record<string, ProblemStatus>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<string>("recognize");

  useEffect(() => {
    getPrimer(slug)
      .then(async (p) => {
        if (!p) {
          setNotFound(true);
          return;
        }
        setPrimer(p);
        track("primer_read", { primer_slug: slug });
        const catalog = await getCatalogBySlugs(p.starter_slugs).catch(() => []);
        const bySlug = new Map(catalog.map((c) => [c.title_slug, c]));
        // A slug missing from the catalog keeps its row (title from the slug)
        // but shows no number and no difficulty rather than a guessed one.
        setStarters(
          p.starter_slugs.map((s) => {
            const hit = bySlug.get(s);
            if (hit) return { ...hit, inCatalog: true };
            return {
              title_slug: s,
              title: prettify(s),
              difficulty: "",
              question_id: "",
              paid_only: false,
              topics: [p.pattern],
              updated_at: new Date().toISOString(),
              inCatalog: false,
            };
          })
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Honest starter glyphs from the reader's own solve history. The status
  // table carries no verification source, so a solved starter renders as a
  // neutral check — never the emerald verified glyph.
  useEffect(() => {
    if (!user || starters.length === 0) return;
    getUserStatusesBySlugs(user.id)
      .then((rows) => {
        const map: Record<string, ProblemStatus> = {};
        for (const r of rows) {
          const key = r.problem_slug.toLowerCase();
          map[key] = r.status === "solved" ? "self-reported" : "attempted";
        }
        setStatusBySlug(map);
      })
      .catch(() => {});
  }, [user, starters]);

  // Reading pages keep the solve dock out of the way: it is hidden while
  // this page is mounted and restored on unmount.
  useEffect(() => {
    const dock = document.querySelector<HTMLElement>(".solve-dock-wrap");
    if (!dock) return;
    const prev = dock.style.display;
    dock.style.display = "none";
    return () => {
      dock.style.display = prev;
    };
  }, []);

  const statusOf = (titleSlug: string): ProblemStatus =>
    statusBySlug[titleSlug.toLowerCase()] ?? "none";

  const nextStarter = useMemo(
    () => starters.find((s) => statusOf(s.title_slug) !== "self-reported") ?? starters[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [starters, statusBySlug]
  );

  // Honest, measurable progress only: read minutes estimated from content
  // length (words/200, min 1) and starters solved from the reader's own
  // user_problem_status rows. No read-state is rendered — it can't be measured.
  const readMinutes = useMemo(() => (primer ? primerReadMinutes(primer) : null), [primer]);
  const solvedStarters = useMemo(
    () => starters.filter((s) => statusOf(s.title_slug) === "self-reported").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [starters, statusBySlug]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-reading space-y-4" aria-label="Loading primer">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (notFound || !primer) {
    return (
      <div className="mx-auto max-w-reading">
        <EmptyState
          heading="This primer does not exist"
          body="It may be deleted, or the link is wrong."
          action={
            <Link href="/primers">
              <Button variant="secondary">All primers</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const scrollTo = (id: string) => {
    setJumpTo(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Only sections with content are numbered and listed in the contents.
  const present: Record<(typeof TOC)[number]["id"], boolean> = {
    recognize: true,
    "mental-model": !!primer.mental_model,
    template: !!primer.template_md,
    complexity: !!primer.complexity,
    mistakes: primer.mistakes.length > 0,
    starters: true,
  };
  const toc = TOC.filter((t) => present[t.id]);
  const numberOf = (id: string) => String(toc.findIndex((t) => t.id === id) + 1).padStart(2, "0");

  const SectionHeading = ({ id, label, aside }: { id: string; label: string; aside?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2 md:border-b-0 md:pb-0">
      <h2 className="flex items-center gap-2 text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pattern md:hidden" />
        <span aria-hidden className="hidden font-mono text-sm font-medium text-pattern tnum md:inline">
          {numberOf(id)}.
        </span>
        {label}
      </h2>
      {aside}
    </div>
  );

  const actionBtn =
    "inline-flex h-9 min-h-[44px] items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0";

  return (
    <div className="mx-auto max-w-[960px] lg:grid lg:grid-cols-[minmax(0,680px)_224px] lg:justify-center lg:gap-12">
      <article className="flex max-w-reading flex-col gap-8 md:gap-10">
        <Suspense fallback={null}>
          <TrackVisit artifact={`primer:${primer.slug}`} />
        </Suspense>

        <div className="flex flex-col gap-3">
          <nav aria-label="Breadcrumb">
            <Link
              href="/primers"
              className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
            >
              Primers / {primer.pattern}
            </Link>
          </nav>

          {/* Mobile table of contents: one scrolling row of jump chips. */}
          <nav
            aria-label="Jump to"
            className="-mx-4 flex items-center gap-2 overflow-x-auto border-y border-hairline px-4 py-1 [scrollbar-width:none] lg:hidden"
          >
            <span className="shrink-0 font-mono text-xs font-medium leading-4 text-text-tertiary">Jump</span>
            {toc.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={jumpTo === t.id ? "location" : undefined}
                onClick={() => scrollTo(t.id)}
                className="flex min-h-[44px] shrink-0 items-center"
              >
                <span
                  className={cn(
                    "inline-flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-xs font-medium leading-4 transition-colors",
                    jumpTo === t.id
                      ? "border-hairline-strong bg-surface-overlay text-text-primary"
                      : "border-hairline bg-surface text-text-secondary"
                  )}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <header className="flex flex-col gap-4 border-b border-hairline pb-8">
          <PatternChip
            label={primer.pattern}
            href={`/patterns/${encodeURIComponent(primer.pattern)}`}
            className="self-start"
          />
          <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary md:text-[44px] md:leading-[1.05] md:tracking-[-0.025em]">
            {primer.title}
          </h1>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium leading-4 text-text-secondary">
              {readMinutes != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                  about {readMinutes} min read
                </span>
              )}
              {readMinutes != null && <span aria-hidden className="text-text-tertiary">·</span>}
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                {primer.starter_slugs.length} starter {primer.starter_slugs.length === 1 ? "problem" : "problems"}
              </span>
              {user && starters.length > 0 && (
                <>
                  <span aria-hidden className="text-text-tertiary">·</span>
                  <span className="tnum">
                    {solvedStarters} of {starters.length} solved
                  </span>
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={actionBtn}
                onClick={async () => {
                  try {
                    await copyPrimerToNotebook(primer.slug);
                    setCopied(true);
                    setCopyMsg("Copied to your notebook.");
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopyMsg("Log in to copy this primer.");
                  }
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                )}
                {copyMsg ?? "Copy to my notebook"}
              </button>
              {/* A primer is shareable only when it is already public. Sending a
                  squad member's writing to a WhatsApp group is publishing it, and
                  the squad chose not to publish it. The link is also the whole
                  share: the text carries the pattern and title, never the body. */}
              {primer.visibility === "public" ? (
                <ShareRow
                  path={`/primers/${primer.slug}`}
                  artifact={{ kind: "primer", id: primer.slug }}
                  text={`${primer.pattern} primer on Mahayuddh: ${primer.title}`}
                  label="Share"
                  compact
                  className="h-9 bg-surface px-3 text-sm"
                />
              ) : (
                <p className="text-xs leading-4 text-text-tertiary">
                  Squad primer — the link only opens for members.
                </p>
              )}
            </div>
          </div>
        </header>

        <section id="recognize" aria-label="Recognize it when" className="flex scroll-mt-24 flex-col gap-3">
          <SectionHeading id="recognize" label="Recognize it when" />
          <ol className="mt-1 flex flex-col gap-2.5">
            {primer.recognize_when.map((r, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-hairline bg-surface p-3.5">
                <span
                  aria-hidden
                  className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-xs border border-hairline bg-well px-1 font-mono text-xs font-medium text-text-tertiary tnum"
                >
                  {i + 1}
                </span>
                <p className="pt-0.5 text-[15px] leading-6 text-text-primary">
                  <InlineText text={r} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        {primer.mental_model && (
          <section id="mental-model" aria-label="Mental model" className="flex scroll-mt-24 flex-col gap-4">
            <SectionHeading id="mental-model" label="Mental model" />
            <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:border-0 md:bg-transparent md:p-0">
              {primer.mental_model
                .split(/\n{2,}/)
                .filter((para) => para.trim())
                .map((para, i) => (
                  <p key={i} className="whitespace-pre-wrap text-[15px] leading-6 text-text-secondary md:text-[17px] md:leading-7">
                    <InlineText text={para.trim()} />
                  </p>
                ))}
            </div>
          </section>
        )}

        {primer.template_md && (
          <section id="template" aria-label="Template" className="flex scroll-mt-24 flex-col gap-3">
            <SectionHeading id="template" label="Template" />
            <CodeBlock code={primer.template_md} label="template" lineNumbers={false} />
          </section>
        )}

        {primer.complexity && (
          <section id="complexity" aria-label="Complexity" className="flex scroll-mt-24 flex-col gap-3">
            <SectionHeading id="complexity" label="Complexity" />
            <div className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-well text-pattern">
                <Gauge className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </span>
              <p className="font-mono text-sm leading-[22px] text-text-primary">{primer.complexity}</p>
            </div>
          </section>
        )}

        {primer.mistakes.length > 0 && (
          <section id="mistakes" aria-label="Common mistakes" className="flex scroll-mt-24 flex-col gap-3">
            <SectionHeading id="mistakes" label="Common mistakes" />
            <ul className="mt-1 flex flex-col gap-2.5">
              {primer.mistakes.map((m, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-hairline bg-surface p-3.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-error/20 bg-error-tint text-error"
                  >
                    <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                  <p className="pt-0.5 text-[15px] leading-6 text-text-primary">
                    <InlineText text={m} />
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="starters" aria-label="Starter problems" className="flex scroll-mt-24 flex-col gap-4">
          <SectionHeading
            id="starters"
            label="Starter problems"
            aside={
              user && starters.length > 0 ? (
                <span className="font-mono text-xs font-medium leading-4 text-text-tertiary tnum">
                  {solvedStarters} of {starters.length} solved
                </span>
              ) : undefined
            }
          />
          <ol className="flex flex-col gap-2">
            {starters.map((s, i) => {
              const st = statusOf(s.title_slug);
              const isNext = nextStarter?.title_slug === s.title_slug;
              return (
                <li key={s.title_slug}>
                  <Link
                    href={`/practice/${s.title_slug}`}
                    className={cn(
                      "relative flex min-h-[56px] items-center justify-between gap-3 overflow-hidden rounded-lg border px-3.5 py-3 transition-colors",
                      isNext
                        ? "border-hairline-strong bg-surface-raised"
                        : "border-hairline bg-surface hover:bg-surface-raised"
                    )}
                  >
                    {isNext && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-text-primary" />}
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-11 shrink-0 font-mono text-xs leading-4 text-text-tertiary tnum sm:w-14">
                        {s.inCatalog && s.question_id ? `No. ${s.question_id}` : String(i + 1)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium leading-5 text-text-primary">{s.title}</span>
                          {isNext && (
                            <span className="hidden shrink-0 rounded-xs border border-hairline-strong px-1.5 font-mono text-[11px] font-medium leading-4 text-text-secondary sm:inline">
                              Up next
                            </span>
                          )}
                        </span>
                        {s.inCatalog && s.difficulty && (
                          <span className="mt-1 flex items-center gap-2">
                            <DifficultyBadgeNew difficulty={s.difficulty} size="sm" />
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {st === "self-reported" ? (
                        <SelfReportedBadge className="hidden sm:inline-flex" />
                      ) : st === "attempted" ? (
                        <span className="hidden h-6 items-center gap-1.5 rounded-sm border border-hairline px-2 text-xs font-medium leading-4 text-text-secondary sm:inline-flex">
                          Attempted
                        </span>
                      ) : null}
                      {isNext ? (
                        <span className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline bg-surface px-3 text-sm font-medium leading-5 text-text-primary">
                          Solve
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        </span>
                      ) : (
                        <span className={cn(st !== "none" && "sm:hidden")}>
                          <StatusGlyph status={st} />
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <footer className="relative flex flex-col items-center gap-4 overflow-hidden rounded-xl border border-hairline bg-surface p-6 text-center md:p-8">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-edge-highlight" />
          <h2 className="type-title text-text-primary">
            Ready? Start with {nextStarter?.title ?? "the first starter"}.
          </h2>
          {nextStarter && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                variant="primary"
                size="lg"
                className="min-h-[44px] font-semibold"
                onClick={() =>
                  startSolving({
                    id: nextStarter.question_id || nextStarter.title_slug,
                    title: nextStarter.title,
                    slug: nextStarter.title_slug,
                    // Unchanged from before: a starter missing from the catalog
                    // starts as Medium, the default the battle flow expects.
                    difficulty: nextStarter.difficulty || "Medium",
                    category: primer.pattern,
                  })
                }
              >
                <Swords className="h-4 w-4" strokeWidth={1.5} />
                Start battle
              </Button>
              <Link href={`/patterns/${encodeURIComponent(primer.pattern)}`}>
                <Button variant="secondary" size="lg" className="w-full min-h-[44px] border border-hairline">
                  Back to {primer.pattern} hub
                </Button>
              </Link>
            </div>
          )}
        </footer>
      </article>

      {/* Sticky table of contents, desktop only */}
      <aside aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-3">
          <span className="px-2 text-xs font-medium leading-4 text-text-tertiary">Contents</span>
          <nav className="flex flex-col gap-0.5 border-l border-hairline pl-2">
            {toc.map((t) => {
              const active = jumpTo === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? "location" : undefined}
                  onClick={() => scrollTo(t.id)}
                  className={cn(
                    "-ml-[9px] flex w-[calc(100%+9px)] items-center justify-between gap-2 rounded-r-sm border-l-2 px-2.5 py-1.5 text-left text-xs font-medium leading-4 transition-colors",
                    active
                      ? "border-text-primary bg-surface-raised text-text-primary"
                      : "border-transparent text-text-secondary hover:bg-surface-raised/50 hover:text-text-primary"
                  )}
                >
                  {t.label}
                  {t.id === "starters" && (
                    <span className="rounded-xs bg-surface-overlay px-1 font-mono text-[10px] leading-4 text-text-secondary tnum">
                      {primer.starter_slugs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}
