"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Reply } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PatternChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  createDiscussionReply,
  getDiscussionReplies,
  type Discussion,
} from "@/lib/data/feed";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { feedActionCls, timeAgo } from "@/components/feed/FeedEventCard";

export function DiscussionCard({ d }: { d: Discussion }) {
  const [replies, setReplies] = useState<Awaited<ReturnType<typeof getDiscussionReplies>>>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReplies(await getDiscussionReplies(d.id).catch(() => []));
  }, [d.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createDiscussionReply(d.id, draft.trim());
      track("feed_action", { via: "reply" });
      setDraft("");
      await load();
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't reply."));
    } finally {
      setBusy(false);
    }
  };

  const name = d.author?.username ?? "someone";
  const count = d.reply_count ?? 0;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:border-hairline-strong md:p-4">
      <div className="flex min-w-0 items-start gap-2 md:gap-3">
        <Avatar name={name} src={d.author?.avatar_url} size="md" className="md:h-9 md:w-9" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-tertiary">
            <span className="text-sm font-semibold text-text-primary">{name}</span>
            <span>· {timeAgo(d.created_at)}</span>
            <span>· {d.visibility === "global" ? "Global" : "Squad"}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-text-primary">
            {d.body_md}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:pl-12">
        <Link
          href={`/practice/${d.problem_slug}`}
          onClick={() => track("feed_action", { via: "open_problem_from_discussion" })}
          className="inline-flex h-6 items-center rounded-xs border border-hairline bg-well px-2 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          {d.problem_slug}
        </Link>
        {d.pattern_tags.map((t) => (
          <PatternChip key={t} label={t} className="rounded-xs px-2" />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 md:border-t md:border-hairline md:pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            feedActionCls,
            "border-hairline bg-surface-raised text-text-primary hover:border-hairline-strong md:border-transparent md:bg-transparent md:text-text-secondary md:hover:bg-surface-raised md:hover:text-text-primary"
          )}
        >
          <Reply className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          {open ? "Hide replies" : "Reply"}
        </button>
        <span className="font-mono text-xs text-text-tertiary tnum">
          {count} {count === 1 ? "reply" : "replies"}
        </span>
      </div>

      {open && (
        <div className="space-y-2 border-l border-hairline pl-3 md:ml-12">
          {replies.map((r) => (
            <div key={r.id}>
              <p className="text-xs text-text-tertiary">
                @{r.author?.username ?? "someone"} · {timeAgo(r.created_at)}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{r.body_md}</p>
            </div>
          ))}
          <form onSubmit={reply} className="flex items-center gap-2 pt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add what you tried…"
              aria-label="Reply"
              className="h-10 min-h-[44px] min-w-0 flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:min-h-0"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || draft.trim().length === 0}
              className="min-h-[44px] md:min-h-0"
            >
              Reply
            </Button>
          </form>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}
    </article>
  );
}
