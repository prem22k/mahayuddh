"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Check, NotebookPen, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { PatternChip } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { copyText } from "@/lib/clipboard";
import {
  getApproachById,
  getApproachesForProblem,
  deleteApproach,
  setApproachVisibility,
} from "@/lib/data/approaches";
import { getUserStatusesBySlugs } from "@/lib/data/sheets";
import { copyApproachToNotebook } from "@/lib/data/notebook";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApproachVisibility } from "@/types/database";

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

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
  const [otherCount, setOtherCount] = useState<number | null>(null);
  const [attempted, setAttempted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revealCode, setRevealCode] = useState(false);

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
      .then((rows) => setOtherCount(rows.filter((r) => r.id !== approach.id).length))
      .catch(() => setOtherCount(null));
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
  const authorName = author?.username ? `@${author.username}` : "@unknown";
  const displayName = author?.username ?? "Unknown";
  const isOwner = approach.user_id === user?.id;
  const problemTitle = prettify(approach.problem_slug);
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
  const codeLines = approach.code ? approach.code.split("\n").length : 0;
  const firstName = displayName.split(" ")[0];

  const DetailRow = ({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) =>
    value ? (
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3">
        <span className="text-sm font-medium leading-5 text-text-secondary">{label}</span>
        <span className={mono ? "font-mono text-sm leading-6 text-text-primary" : "whitespace-pre-wrap text-[15px] leading-6 text-text-primary"}>
          {value}
        </span>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <nav aria-label="Breadcrumb">
        <Link
          href={`/practice/${approach.problem_slug}`}
          className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
        >
          Practice / {problemTitle} / {displayName}&rsquo;s approach
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar name={displayName} src={author?.avatar_url} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-5 text-text-primary">{displayName}</div>
            <div className="text-xs leading-4 text-text-tertiary">
              {authorName} · {approach.visibility} ·{" "}
              {new Date(approach.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
          <Link
            href={`/practice/${approach.problem_slug}`}
            className="block truncate text-sm font-medium leading-5 text-text-primary hover:underline"
          >
            {problemTitle}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-text-tertiary">No. {approach.problem_slug}</span>
            {approach.pattern && (
              <PatternChip
                label={approach.pattern}
                href={`/patterns/${encodeURIComponent(approach.pattern)}`}
              />
            )}
          </div>
        </div>
      </header>

      <section aria-label="Core idea" className="card">
        <h2 className="text-xs font-medium leading-4 text-text-tertiary">Core idea</h2>
        <p className="mt-2 whitespace-pre-wrap text-[17px] leading-7 text-text-primary">{approach.core_idea}</p>
      </section>

      <section aria-label="Details" className="divide-y divide-hairline">
        <DetailRow label="Time" value={approach.complexity_time} mono />
        <DetailRow label="Space" value={approach.complexity_space} mono />
        <DetailRow label="Key detail" value={approach.key_detail} />
        <DetailRow label="Edge cases" value={approach.edge_cases} />
        <DetailRow label="Mistakes" value={approach.mistakes} />
      </section>

      {approach.code && (
        <section aria-label="Code" className="rounded-xl border border-hairline bg-well p-4">
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-text-secondary">
              Code · {codeLines} {codeLines === 1 ? "line" : "lines"}
            </span>
            {!revealCode && (
              <Button variant="secondary" onClick={() => setRevealCode(true)}>
                Reveal code
              </Button>
            )}
          </div>
          {revealCode ? (
            <div className="mt-3 space-y-2">
              <pre className="overflow-x-auto font-mono text-sm leading-6 text-text-primary">
                <code>{approach.code}</code>
              </pre>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (await copyText(approach.code ?? "")) {
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }
                }}
              >
                {codeCopied ? (
                  <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                )}
                {codeCopied ? "Copied" : "Copy code"}
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-text-tertiary">
              Hidden so you solve it first. Read it after your own attempt.
              {attempted === false && " You have not attempted this yet."}
            </p>
          )}
        </section>
      )}

      <nav aria-label="Next steps" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {otherCount !== null && otherCount > 0 ? (
          <Link href={`/practice/${approach.problem_slug}/compare`}>
            <Button variant="secondary" className="w-full min-h-[44px] sm:w-auto">
              Compare with {otherCount} other {otherCount === 1 ? "approach" : "approaches"}
            </Button>
          </Link>
        ) : (
          <Link href={`/practice/${approach.problem_slug}/compare`}>
            <Button variant="secondary" className="w-full min-h-[44px] sm:w-auto">
              Compare approaches
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          className="min-h-[44px]"
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
        </Button>
        {user && (
          <Button
            variant="ghost"
            className="min-h-[44px]"
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
            <NotebookPen className="h-4 w-4" strokeWidth={1.5} />
            {saved ? "Saved to notebook" : "Copy to my notebook"}
          </Button>
        )}
        {!isOwner && (
          <Link href="/challenges">
            <Button variant="ghost" className="w-full min-h-[44px] sm:w-auto">
              Challenge {firstName}
            </Button>
          </Link>
        )}
      </nav>

      {isOwner && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
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
          <Button
            variant="ghost"
            aria-label="Delete approach"
            onClick={async () => {
              if (!window.confirm("Delete this approach?")) return;
              await deleteApproach(approach.id);
              load();
            }}
            className="text-text-tertiary hover:text-error"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
}
