"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Check, ChevronRight, Clock, Copy } from "lucide-react";
import type { Approach, Primer } from "@/types/database";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import { formatDuration, titleFromSlug } from "@/lib/format";
import { copiesOf, type ProblemMeta, type SolveProof } from "./portfolio";

/**
 * A person's public teaching (§21, §22).
 *
 * Public rows only. Tabs switch views of the same teaching, so a segmented
 * underline pair fits: Approaches | Primers.
 *
 * Stitch rows: No. · title · difficulty · pattern, the core idea quoted on one
 * line, then the author's solve time, how often it was copied, and a chevron.
 * On a phone the meta moves under the title and the footer gets its own line.
 * Time and copies render only when they exist.
 */
export function PublicProfileBody({
  approaches,
  primers,
  problems = {},
  proofs = {},
  totalApproaches,
}: {
  approaches: Approach[];
  primers: Primer[];
  /** Catalog facts by problem slug. Optional: rows fall back to the slug. */
  problems?: Record<string, ProblemMeta>;
  /** The author's own solve per problem slug, as /a/[id] shows it. */
  proofs?: Record<string, SolveProof>;
  /** Total public approaches, when known, so a capped list can say so. */
  totalApproaches?: number;
}) {
  const [tab, setTab] = useState<"Approaches" | "Primers">("Approaches");

  if (approaches.length === 0 && primers.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em] md:text-xl">Public teaching</h2>
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-raised text-text-tertiary">
            <BookOpen className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="font-display text-base font-medium text-text-primary">Nothing published yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-text-tertiary">
            An approach or a primer shared publicly shows up here.
          </p>
        </div>
      </section>
    );
  }

  const more = totalApproaches != null && totalApproaches > approaches.length ? totalApproaches : null;

  return (
    <section className="space-y-4 md:space-y-6">
      <UnderlineTabs
        tabs={["Approaches", "Primers"]}
        value={tab}
        counts={{ Approaches: approaches.length, Primers: primers.length }}
        onChange={(v) => setTab(v === "Primers" ? "Primers" : "Approaches")}
      />
      {tab === "Approaches" ? (
        approaches.length === 0 ? (
          <p className="text-sm leading-6 text-text-secondary">No public approaches yet.</p>
        ) : (
          <>
            <ul className="space-y-2 md:space-y-3">
              {approaches.map((a) => (
                <li key={a.id}>
                  <ApproachRow
                    approach={a}
                    meta={problems[a.problem_slug.toLowerCase()] ?? null}
                    proof={proofs[a.problem_slug.toLowerCase()] ?? null}
                  />
                </li>
              ))}
            </ul>
            {more && (
              <p className="text-center text-xs leading-5 text-text-tertiary">
                Showing the latest {approaches.length} of {more} public approaches.
              </p>
            )}
          </>
        )
      ) : primers.length === 0 ? (
        <p className="text-sm leading-6 text-text-secondary">No public primers yet.</p>
      ) : (
        <ul className="space-y-2 md:space-y-3">
          {primers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/primers/${p.slug}`}
                className="group flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong sm:flex-row sm:items-center sm:justify-between md:rounded-xl md:p-5"
              >
                <div className="min-w-0 max-w-xl space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PatternChip label={p.pattern} />
                    {p.starter_slugs?.length > 0 && (
                      <span className="text-xs text-text-tertiary">
                        {p.starter_slugs.length} starter {p.starter_slugs.length === 1 ? "problem" : "problems"}
                      </span>
                    )}
                  </div>
                  <p className="font-display text-base font-semibold text-text-primary md:text-lg">{p.title}</p>
                  {p.recognize_when?.length > 0 && (
                    <p className="line-clamp-2 text-sm leading-6 text-text-secondary">{p.recognize_when[0]}</p>
                  )}
                </div>
                <span className="inline-flex h-9 shrink-0 items-center justify-center self-start rounded-md border border-hairline bg-surface-raised px-4 text-xs font-medium text-text-primary transition-colors group-hover:bg-surface-overlay sm:self-auto">
                  Read primer
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApproachRow({
  approach: a,
  meta,
  proof,
}: {
  approach: Approach;
  meta: ProblemMeta | null;
  proof: SolveProof | null;
}) {
  const title = meta?.title ?? titleFromSlug(a.problem_slug);
  const time = formatDuration(proof?.seconds);
  const copies = copiesOf(a);
  const timeChip = time ? (
    <span
      className="inline-flex items-center gap-1 font-mono text-[11px] text-text-tertiary tnum md:text-xs md:text-text-secondary"
      title={proof?.verified ? "Author's fastest LeetCode-verified solve" : "Author's fastest self-reported solve"}
    >
      {proof?.verified ? (
        <Check className="h-3.5 w-3.5 text-verified" strokeWidth={2} aria-hidden />
      ) : (
        <Clock className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
      )}
      {time}
    </span>
  ) : null;

  return (
    // Public rows only (the page query filters visibility=public), so the
    // public projection is the honest target — the authed /approach/[id]
    // page would bounce a logged-out visitor.
    <Link
      href={`/a/${a.id}`}
      className="group block rounded-lg border border-hairline bg-surface p-3 transition-colors hover:border-hairline-strong hover:bg-surface-raised md:rounded-xl md:p-5"
    >
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0 space-y-1.5 md:space-y-2">
          <div className="flex items-center justify-between gap-2 md:justify-start md:gap-2.5">
            <div className="flex min-w-0 items-center gap-1.5 md:gap-2.5">
              {meta?.questionId && (
                <span className="shrink-0 font-mono text-[11px] text-text-tertiary tnum md:text-xs">
                  No. {meta.questionId}
                </span>
              )}
              <h3 className="truncate text-xs font-medium text-text-primary md:font-display md:text-base md:font-semibold">
                {title}
              </h3>
            </div>
            <span className="shrink-0 md:hidden">{timeChip}</span>
            <span className="hidden shrink-0 items-center gap-2 md:flex">
              {meta?.difficulty && <DifficultyBadgeNew difficulty={meta.difficulty} />}
              {a.pattern && <PatternChip label={a.pattern} />}
            </span>
          </div>
          {(meta?.difficulty || a.pattern) && (
            <div className="flex items-center gap-2 md:hidden">
              {meta?.difficulty && <DifficultyBadgeNew difficulty={meta.difficulty} size="sm" />}
              {a.pattern && <PatternChip label={a.pattern} className="h-5 px-2 text-[11px]" />}
            </div>
          )}
          <p className="line-clamp-1 text-[11px] italic leading-snug text-text-secondary md:text-sm md:leading-6">
            “{a.core_idea.trim()}”
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline pt-1.5 text-xs text-text-tertiary md:justify-end md:border-0 md:pt-0">
          <span className="hidden md:inline-flex">{timeChip}</span>
          {copies > 0 ? (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-secondary tnum md:text-xs">
              <Copy className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
              copied {copies} {copies === 1 ? "time" : "times"}
            </span>
          ) : (
            <span className="md:hidden" />
          )}
          <span className="font-mono text-[11px] text-text-tertiary md:hidden">Read approach →</span>
          <ChevronRight
            className="hidden h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary md:block"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}
