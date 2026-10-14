"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, Copy, Check } from "lucide-react";
import { useSolving } from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { PatternChip, DifficultyBadgeNew } from "@/components/ui/Badge";
import { StatusGlyph, type ProblemStatus } from "@/components/ui/ProblemRow";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { getPrimer, primerReadMinutes } from "@/lib/data/primers";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getUserStatusesBySlugs } from "@/lib/data/sheets";
import { copyPrimerToNotebook } from "@/lib/data/notebook";
import { copyText } from "@/lib/clipboard";
import { track } from "@/lib/analytics";
import { Primer, Problem } from "@/types/database";

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
  const [starters, setStarters] = useState<Problem[]>([]);
  const [statusBySlug, setStatusBySlug] = useState<Record<string, ProblemStatus>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [templateCopied, setTemplateCopied] = useState(false);
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
        setStarters(
          p.starter_slugs.map(
            (s) =>
              bySlug.get(s) ?? {
                title_slug: s,
                title: prettify(s),
                difficulty: "Medium",
                question_id: s,
                paid_only: false,
                topics: [p.pattern],
                updated_at: new Date().toISOString(),
              }
          )
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
        <Skeleton className="h-8 w-2/3" />
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

  return (
    <div className="mx-auto max-w-[960px] lg:grid lg:grid-cols-[minmax(0,680px)_200px] lg:justify-center lg:gap-10">
      <article className="max-w-reading space-y-8">
        <Suspense fallback={null}>
          <TrackVisit artifact={`primer:${primer.slug}`} />
        </Suspense>

        <nav aria-label="Breadcrumb">
          <Link
            href="/primers"
            className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
          >
            Primers / {primer.pattern}
          </Link>
        </nav>

        {/* Mobile table of contents */}
        <div className="lg:hidden">
          <label htmlFor="primer-jump" className="mb-1 block text-sm font-medium leading-5 text-text-primary">
            Jump to
          </label>
          <select
            id="primer-jump"
            value={jumpTo}
            onChange={(e) => scrollTo(e.target.value)}
            className="h-10 w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary focus:border-hairline-strong focus:outline-none"
          >
            {TOC.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <header className="space-y-3">
          <PatternChip label={primer.pattern} href={`/patterns/${encodeURIComponent(primer.pattern)}`} />
          <h1 className="type-display-md text-text-primary">{primer.title}</h1>
          <p className="text-sm leading-6 text-text-secondary">
            {primer.starter_slugs.length} starter problems
            {readMinutes != null && ` · about ${readMinutes} min read`}
            {user && starters.length > 0 && ` · ${solvedStarters} of ${starters.length} solved`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
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
            </Button>
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
              />
            ) : (
              <p className="text-xs leading-4 text-text-tertiary">
                Squad primer — the link only opens for members.
              </p>
            )}
          </div>
        </header>

        <section id="recognize" aria-label="Recognize it when" className="scroll-mt-20 space-y-3">
          <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Recognize it when</h2>
          <ol className="list-decimal space-y-2 pl-5 text-[17px] leading-7 text-text-primary">
            {primer.recognize_when.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>

        {primer.mental_model && (
          <section id="mental-model" aria-label="Mental model" className="scroll-mt-20 space-y-3">
            <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Mental model</h2>
            <p className="whitespace-pre-wrap text-[17px] leading-7 text-text-primary">{primer.mental_model}</p>
          </section>
        )}

        {primer.template_md && (
          <section id="template" aria-label="Template" className="scroll-mt-20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Template</h2>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (await copyText(primer.template_md ?? "")) {
                    setTemplateCopied(true);
                    setTimeout(() => setTemplateCopied(false), 2000);
                  }
                }}
              >
                {templateCopied ? (
                  <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                )}
                {templateCopied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-hairline bg-well p-4 font-mono text-sm leading-6 text-text-primary">
              <code>{primer.template_md}</code>
            </pre>
          </section>
        )}

        {primer.complexity && (
          <section id="complexity" aria-label="Complexity" className="scroll-mt-20 space-y-3">
            <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Complexity</h2>
            <p className="font-mono text-sm leading-6 text-text-primary">{primer.complexity}</p>
          </section>
        )}

        {primer.mistakes.length > 0 && (
          <section id="mistakes" aria-label="Common mistakes" className="scroll-mt-20 space-y-3">
            <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Common mistakes</h2>
            <ul className="space-y-2">
              {primer.mistakes.map((m, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-hairline bg-surface px-4 py-3 text-[15px] leading-6 text-text-primary"
                >
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="starters" aria-label="Starter problems" className="scroll-mt-20 space-y-3">
          <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Starter problems</h2>
          <ol className="space-y-2">
            {starters.map((s, i) => {
              const st = statusOf(s.title_slug);
              const isNext = nextStarter?.title_slug === s.title_slug;
              return (
                <li key={s.title_slug}>
                  <Link
                    href={`/practice/${s.title_slug}`}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      isNext
                        ? "border-hairline-strong bg-surface-raised"
                        : "border-hairline bg-surface hover:bg-surface-raised"
                    }`}
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-xs text-text-tertiary">{i + 1}</span>
                    <StatusGlyph status={st} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                        {s.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-text-tertiary">No. {s.question_id}</span>
                        <DifficultyBadgeNew difficulty={s.difficulty} />
                      </span>
                    </span>
                    {isNext && (
                      <span className="shrink-0 text-xs font-medium leading-4 text-text-secondary">Up next</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <footer className="card space-y-3">
          <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">
            Ready? Start with {nextStarter?.title ?? "the first starter"}.
          </h2>
          {nextStarter && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="primary"
                size="lg"
                className="min-h-[44px]"
                onClick={() =>
                  startSolving({
                    id: nextStarter.question_id || nextStarter.title_slug,
                    title: nextStarter.title,
                    slug: nextStarter.title_slug,
                    difficulty: nextStarter.difficulty,
                    category: primer.pattern,
                  })
                }
              >
                <Play className="h-4 w-4" strokeWidth={1.5} />
                Start battle
              </Button>
              <Link href={`/patterns/${encodeURIComponent(primer.pattern)}`}>
                <Button variant="ghost">Back to {primer.pattern} hub</Button>
              </Link>
            </div>
          )}
        </footer>
      </article>

      {/* Sticky table of contents, desktop only */}
      <aside aria-label="On this page" className="hidden lg:block">
        <nav className="sticky top-20 space-y-1">
          {TOC.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => scrollTo(t.id)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm leading-5 transition-colors ${
                jumpTo === t.id ? "bg-surface-overlay text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}
