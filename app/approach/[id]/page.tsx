"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Copy, NotebookPen, Swords, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { ShareRow } from "@/components/ui/ShareRow";
import { ApproachHeaderCard, CoreIdeaCard, ApproachDetails } from "@/components/approach/ApproachParts";
import { ApproachCode } from "@/components/approach/ApproachCode";
import { pickSolveProof, type SolveProof } from "@/components/approach/solveProof";
import { copyText } from "@/lib/clipboard";
import {
  getApproachById,
  getApproachesForProblem,
  deleteApproach,
  setApproachVisibility,
} from "@/lib/data/approaches";
import { getUserStatusesBySlugs } from "@/lib/data/sheets";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { getProblemTimeline } from "@/lib/data/problemEvents";
import { copyApproachToNotebook } from "@/lib/data/notebook";
import { dataErrorMessage } from "@/lib/data/errors";
import { formatDuration } from "@/lib/format";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/providers/AuthProvider";
import { Approach, ApproachVisibility, Problem } from "@/types/database";

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const deckBtn =
  "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium leading-5 transition-colors md:h-9 md:w-auto";

/**
 * Approach detail page (plan Step 9: "Approach view page with Copy-to-Notebook").
 *
 * Before this, code / key_detail / edge_cases / mistakes were stored but never
 * rendered anywhere. Sharing an approach meant sharing a truncated paragraph.
 * Spoiler discipline (Bible §12): the code stays collapsed until the reader
 * opts in, so learning is not short-circuited by a peek.
 */
export default function ApproachPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, profile } = useAuth();
  const [approach, setApproach] = useState<Awaited<ReturnType<typeof getApproachById>>>(null);
  const [others, setOthers] = useState<Approach[] | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [proof, setProof] = useState<SolveProof | null>(null);
  const [attempted, setAttempted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setApproach(await getApproachById(id));
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load this approach. Retry."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Sibling approaches for the compare link, and whether the reader has
  // attempted the problem (drives the "you haven't attempted this yet" note).
  useEffect(() => {
    if (!approach) return;
    getApproachesForProblem(approach.problem_slug)
      .then((rows) => setOthers(rows.filter((r) => r.id !== approach.id)))
      .catch(() => setOthers(null));
    // Catalog row for the problem number, title and difficulty, and the
    // author's own solve for the proof box. Both are optional: on failure the
    // title falls back to the slug and the proof box stays hidden.
    getCatalogBySlugs([approach.problem_slug])
      .then((rows) => setProblem(rows[0] ?? null))
      .catch(() => setProblem(null));
    getProblemTimeline(approach.problem_slug, approach.user_id)
      .then((events) => setProof(pickSolveProof(events)))
      .catch(() => setProof(null));
    if (!user) {
      setAttempted(null);
      return;
    }
    getUserStatusesBySlugs(user.id)
      .then((rows) =>
        setAttempted(rows.some((r) => r.problem_slug.toLowerCase() === approach.problem_slug.toLowerCase()))
      )
      .catch(() => setAttempted(null));
  }, [approach, user]);

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

  if (loading) return <PageLoader label="Loading approach..." />;
  if (loadError) {
    return (
      <div className="mx-auto max-w-reading">
        <ErrorCard message={loadError} onRetry={load} />
      </div>
    );
  }
  if (!approach) {
    return (
      <div className="mx-auto max-w-reading">
        <EmptyState
          heading="This approach does not exist"
          body="It may be private to its author, or deleted."
          action={
            <Link href="/practice">
              <Button variant="secondary">Back to practice</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const author = approach.author ?? approach.author_profile;
  const displayName = author?.username ?? "Unknown";
  const isOwner = approach.user_id === user?.id;
  const problemTitle = problem?.title ?? prettify(approach.problem_slug);
  // `fork_count` is trigger-maintained on approaches (select * returns it);
  // it is not on the shared Approach type.
  const forkCount = (approach as Approach & { fork_count?: number | null }).fork_count ?? null;
  const asText = [
    approach.core_idea,
    approach.complexity_time ? `Time: ${approach.complexity_time}` : "",
    approach.complexity_space ? `Space: ${approach.complexity_space}` : "",
    approach.key_detail ? `Key detail: ${approach.key_detail}` : "",
    approach.edge_cases ? `Edge cases: ${approach.edge_cases}` : "",
    approach.mistakes ? `Mistakes: ${approach.mistakes}` : "",
    approach.code ? `\n\`\`\`\n${approach.code}\n\`\`\`` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const firstName = displayName.split(" ")[0];
  const otherCount = others?.length ?? null;
  const beat = proof ? formatDuration(proof.seconds) : null;

  return (
    <div className="mx-auto flex max-w-reading flex-col gap-5 md:gap-6">
      <nav aria-label="Breadcrumb">
        <Link
          href={`/practice/${approach.problem_slug}`}
          className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
        >
          Practice / {problemTitle} / {displayName}&rsquo;s approach
        </Link>
      </nav>

      <ApproachHeaderCard
        username={displayName}
        avatarUrl={author?.avatar_url}
        visibility={approach.visibility}
        createdAt={approach.created_at}
        forkCount={forkCount}
        isOwner={isOwner}
        actions={
          // Only a public approach has a shareable projection (/a/[id]).
          approach.visibility === "public" ? (
            <ShareRow
              path={`/a/${approach.id}`}
              artifact={{ kind: "approach", id: approach.id }}
              text={`@${displayName}'s approach to ${problemTitle} on Mahayuddh.\n${approach.core_idea.split("\n")[0] ?? ""}`.trim()}
              label="Share"
              compact
              className="h-8 bg-well"
            />
          ) : undefined
        }
        problem={{
          number: problem?.question_id || null,
          title: problemTitle,
          difficulty: problem?.difficulty ?? null,
          href: `/practice/${approach.problem_slug}`,
        }}
        pattern={approach.pattern}
        proof={proof}
      />

      <CoreIdeaCard text={approach.core_idea} />

      <ApproachDetails
        time={approach.complexity_time}
        space={approach.complexity_space}
        keyDetail={approach.key_detail}
        edgeCases={approach.edge_cases}
        mistakes={approach.mistakes}
      />

      {approach.code && <ApproachCode code={approach.code} spoiler unattempted={attempted === false} />}

      <nav
        aria-label="Next steps"
        className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3 md:p-4"
      >
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <Link
            href={`/practice/${approach.problem_slug}/compare`}
            className={`${deckBtn} border border-hairline bg-surface-raised text-text-primary hover:bg-surface-overlay`}
          >
            <ArrowLeftRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            {otherCount !== null && otherCount > 0
              ? `Compare with ${otherCount} other ${otherCount === 1 ? "approach" : "approaches"}`
              : "Compare approaches"}
          </Link>
          {user && (
            <button
              type="button"
              className={`${deckBtn} text-text-secondary hover:bg-surface-raised hover:text-text-primary`}
              onClick={async () => {
                try {
                  await copyApproachToNotebook(approach.id);
                  track("note_copied", { fork_of: approach.id });
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                } catch {
                  // logged out or RLS: the plain Copy button still works
                }
              }}
            >
              <NotebookPen className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {saved ? "Saved to notebook" : "Copy to my notebook"}
            </button>
          )}
          <button
            type="button"
            className={`${deckBtn} text-text-secondary hover:bg-surface-raised hover:text-text-primary`}
            onClick={async () => {
              if (await copyText(asText)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
          >
            {copied ? (
              <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.5} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {!isOwner && (
          // The screen's one gold element: the competitive next step.
          <Link
            href="/challenges"
            className={`${deckBtn} group border border-primary/40 bg-well text-primary hover:bg-surface-raised`}
          >
            <Swords className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Challenge {firstName}
            {beat && (
              <span className="font-mono text-[11px] font-medium text-text-tertiary tnum group-hover:text-primary">
                (Beat {beat})
              </span>
            )}
          </Link>
        )}
      </nav>

      {others && others.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 rounded-xl border border-hairline bg-well/50 p-3 md:gap-y-2 md:p-4">
          <span className="text-xs leading-4 text-text-tertiary">Other approaches:</span>
          {others.slice(0, 4).map((o) => {
            const name = o.author?.username ?? o.author_profile?.username ?? "unknown";
            return (
              <Link
                key={o.id}
                href={`/approach/${o.id}`}
                className="inline-flex min-h-[44px] items-center md:min-h-0"
              >
                <span className="inline-flex h-6 items-center gap-1.5 rounded-xs border border-hairline bg-surface px-2 text-xs leading-4 text-text-secondary transition-colors hover:text-text-primary">
                  <Avatar name={name} src={o.author?.avatar_url} size="sm" className="h-4 w-4 text-[8px]" />
                  @{name}
                </span>
              </Link>
            );
          })}
          {others.length > 4 && (
            <span className="font-mono text-xs leading-4 text-text-tertiary tnum">+{others.length - 4} more</span>
          )}
        </div>
      )}

      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium leading-5 text-text-secondary">Visibility</span>
            <div
              role="group"
              aria-label="Visibility"
              className="flex h-9 items-center gap-1 rounded-md border border-hairline bg-well p-1"
            >
              {(["private", "squad", "public"] as ApproachVisibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={approach.visibility === v}
                  onClick={async () => {
                    if (v === "squad" && !profile?.active_squad_id) return;
                    await setApproachVisibility(approach.id, v, profile?.active_squad_id ?? null);
                    load();
                  }}
                  className={`flex h-full min-h-[44px] items-center rounded-sm px-3 text-sm font-medium leading-5 transition-colors md:min-h-0 ${
                    approach.visibility === v ? "bg-surface-overlay text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            aria-label="Delete approach"
            onClick={async () => {
              if (!window.confirm("Delete this approach?")) return;
              await deleteApproach(approach.id);
              load();
            }}
            className="min-h-[44px] text-text-tertiary hover:text-error md:min-h-0"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
}
