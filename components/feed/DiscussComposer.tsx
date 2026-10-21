"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  checkDiscussionDraft,
  draftMessage,
  globalPostBlockedBy,
  type DiscussionDraft,
} from "@/lib/feedPolicy";
import { createDiscussion } from "@/lib/data/feed";
import { dataErrorMessage } from "@/lib/data/errors";

/**
 * The Discuss tile — the only prose the feed accepts (§51).
 *
 * Every other composer tile creates an object that already exists (a solve, a
 * challenge, a stuck request, a vault note). This one is the exception, and it
 * is gated: problem-linked, pattern-linked, actionable, rate-limited, and
 * Global needs logged solves.
 *
 * The gates are checked twice — once here for immediate feedback, once in the
 * database. This copy of the rules is a preview; the server's answer is the one
 * that counts, and its error message is what the user sees if they disagree.
 */
export function DiscussComposer({
  squadId,
  solveCount,
  onClose,
  onPosted,
}: {
  squadId: string | null;
  solveCount: number;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [patterns, setPatterns] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"squad" | "global">("squad");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = patterns
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const draft: DiscussionDraft = {
    problemSlug: slug.trim().toLowerCase(),
    patternTags: tags,
    body,
    visibility,
  };
  const verdict = checkDiscussionDraft(draft);
  const globalBlocked = visibility === "global" && globalPostBlockedBy(solveCount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verdict.ok || globalBlocked) return;
    setBusy(true);
    setError(null);
    try {
      await createDiscussion({
        problemSlug: draft.problemSlug,
        patternTags: tags,
        body: body.trim(),
        visibility,
        squadId,
      });
      onPosted();
      onClose();
    } catch (err) {
      // Database messages are written to be shown as-is. Replacing them with a
      // generic failure would throw away the only explanation the user gets.
      setError(dataErrorMessage(err, "Couldn't post. Retry."));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full min-h-[44px] rounded-md border border-hairline bg-well px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none";
  const labelCls =
    "mb-1.5 block text-sm font-medium text-text-primary max-md:font-mono max-md:text-xs max-md:uppercase max-md:tracking-[0.06em] max-md:text-text-tertiary";

  return (
    <ModalShell
      label="Start a discussion"
      onClose={onClose}
      variant="sheet"
      zIndexClass="z-[300]"
      maxWidthClass="max-w-[560px]"
      panelClassName="flex max-h-[92dvh] flex-col overflow-hidden p-0 md:max-h-[calc(100dvh-32px)]"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-4 pb-2.5 pt-6 md:px-6 md:pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
              Start a discussion
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">
              Problem-linked and pattern-linked, or it won&apos;t be findable later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:mr-0 md:h-8 md:w-8"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 md:space-y-5 md:px-6 md:py-4">
          <label className="block">
            <span className={labelCls}>Problem slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="two-sum"
              className={`${inputCls} font-mono`}
            />
          </label>

          <label className="block">
            <span className={labelCls}>Patterns (comma separated)</span>
            <input
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
              placeholder="Arrays, Hash Table"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>What did you try, and what should the reader try?</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Try solving it without the hash map first — what breaks?"
              className="w-full resize-y rounded-md border border-hairline bg-well px-3 py-2.5 text-[15px] leading-6 text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none max-md:text-sm"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-text-tertiary max-md:font-mono max-md:uppercase max-md:tracking-[0.06em]">
                Who sees it
              </span>
              <SegmentedControl
                label="Who sees it"
                value={visibility}
                onChange={setVisibility}
                className="max-md:h-auto [&>button]:whitespace-nowrap"
                options={[
                  { value: "squad", label: "Squad" },
                  { value: "global", label: "Everyone" },
                ]}
              />
            </div>
            {globalBlocked && (
              <p className="text-xs leading-5 text-primary">
                Posting to Everyone needs 3 logged solves. You have {solveCount}. Your squad
                feed is open now —{" "}
                <Link href="/practice" className="underline underline-offset-4">
                  solve something
                </Link>
                .
              </p>
            )}
          </div>

          {/* The verdict is shown as guidance, not as an error. It is a preview of
              a rule the database will apply for real. */}
          {!verdict.ok && body.length > 0 && (
            <p className="text-xs leading-5 text-text-secondary">{draftMessage(verdict)}</p>
          )}

          {error && (
            <div role="alert" className="rounded-md border border-error/30 bg-error-tint px-3 py-2 text-xs leading-5 text-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-hairline bg-surface-raised p-4 pb-[calc(16px+env(safe-area-inset-bottom))] md:justify-end md:bg-surface md:px-6 md:pb-4">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="h-11 flex-1 border border-hairline bg-surface md:h-10 md:flex-none md:border-transparent md:bg-transparent"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!verdict.ok || globalBlocked || busy}
            loading={busy}
            className="h-11 flex-[2] font-semibold md:h-10 md:flex-none md:px-6 md:font-medium"
          >
            {!busy && "Post"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
