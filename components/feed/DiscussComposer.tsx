"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
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

  return (
    <ModalShell label="Start a discussion" onClose={onClose} alignTop>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Start a discussion</h2>
          <p className="text-[11px] text-white/40 mt-1">
            Problem-linked and pattern-linked, or it won&apos;t be findable later.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            Problem slug
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="two-sum"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            Patterns (comma separated)
          </span>
          <input
            value={patterns}
            onChange={(e) => setPatterns(e.target.value)}
            placeholder="Arrays, Hash Table"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            What did you try, and what should the reader try?
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Try solving it without the hash map first — what breaks?"
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-y"
          />
        </label>

        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40">Who sees it</span>
          <div className="flex gap-2">
            {(["squad", "global"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                  visibility === v
                    ? "bg-white/[0.12] text-white"
                    : "bg-white/[0.04] text-white/40 hover:text-white/70"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {globalBlocked && (
            <p className="text-[11px] text-[#ffd60a]">
              Posting to Global needs 3 logged solves. You have {solveCount}. Your squad
              feed is open now —{" "}
              <Link href="/practice" className="underline">
                solve something
              </Link>
              .
            </p>
          )}
        </div>

        {/* The verdict is shown as guidance, not as an error. It is a preview of
            a rule the database will apply for real. */}
        {!verdict.ok && body.length > 0 && (
          <p className="text-[11px] text-white/40">{draftMessage(verdict)}</p>
        )}

        {error && (
          <div role="alert" className="text-[11px] text-[#ff453a]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-bold text-white/50 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!verdict.ok || globalBlocked || busy}
            className="px-5 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {busy && <Spinner size="xs" tone="inverse" />}
            Post
          </button>
        </div>
      </form>
    </ModalShell>
  );
}