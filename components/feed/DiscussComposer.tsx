"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
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
  const labelCls = "mb-1.5 block text-sm font-medium text-text-secondary";

  return (
    <ModalShell label="Start a discussion" onClose={onClose} maxWidthClass="max-w-[560px]">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Start a discussion</h2>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Problem-linked and pattern-linked, or it won&apos;t be findable later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <label className="block">
          <span className={labelCls}>Problem slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="two-sum"
            className={inputCls}
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
            className="w-full resize-y rounded-md border border-hairline bg-well px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none"
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-text-secondary">Who sees it</span>
          <div className="flex gap-1.5 rounded-md bg-well p-1">
            {(["squad", "global"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                aria-pressed={visibility === v}
                className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium capitalize transition-colors ${
                  visibility === v
                    ? "bg-surface-overlay text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {v === "global" ? "Everyone" : "Squad"}
              </button>
            ))}
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

        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" type="button" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!verdict.ok || globalBlocked || busy}
            loading={busy}
            className="min-h-[44px]"
          >
            {!busy && "Post"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
