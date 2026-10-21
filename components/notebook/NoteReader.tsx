"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Share2, Trash2 } from "lucide-react";
import { PatternChip } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/States";
import { NoteBody } from "@/components/notebook/RichText";
import { VisibilityTag, shortAgo } from "@/components/notebook/noteMeta";
import { cn } from "@/lib/utils";
import type { NotebookNoteSummary } from "@/types/database";

export type NoteProblem = { number: string | null; title: string };

const actionBtn =
  "inline-flex h-9 min-h-[44px] items-center gap-1.5 rounded-md border border-hairline px-3 text-sm font-medium leading-5 transition-colors md:min-h-0";

/**
 * The open note. `pane` is the desktop right-hand reader card (header, meta
 * row, 680px body); `inline` is the mobile expansion inside the selected list
 * card (the card itself carries title and meta), so it renders body + actions.
 */
export function NoteReader({
  note,
  body,
  loading,
  problem,
  isOwner,
  onEdit,
  onDelete,
  onRetryBody,
  shareName,
  onShareNameChange,
  onShare,
  formError,
  idPrefix,
  variant,
}: {
  note: NotebookNoteSummary;
  body: string | undefined;
  loading: boolean;
  problem: NoteProblem | null;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRetryBody: () => void;
  shareName: string;
  onShareNameChange: (v: string) => void;
  onShare: () => void;
  formError: string | null;
  idPrefix: string;
  variant: "pane" | "inline";
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const inputId = `${idPrefix}-share-user`;

  const actions = (
    <div className={cn("flex shrink-0 items-center gap-2", variant === "inline" && "justify-end")}>
      <button type="button" onClick={onEdit} className={cn(actionBtn, "bg-surface-raised text-text-primary hover:bg-surface-overlay")}>
        <Pencil className="h-4 w-4" strokeWidth={1.5} />
        Edit
      </button>
      {isOwner && (
        <button
          type="button"
          aria-expanded={shareOpen}
          aria-controls={`${idPrefix}-share`}
          onClick={() => setShareOpen((o) => !o)}
          className={cn(
            actionBtn,
            shareOpen
              ? "bg-surface-raised text-text-primary"
              : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          )}
        >
          <Share2 className="h-4 w-4" strokeWidth={1.5} />
          Share 1:1
        </button>
      )}
      <button
        type="button"
        aria-label="Delete note"
        onClick={onDelete}
        className="inline-flex h-9 min-h-[44px] w-9 min-w-[44px] items-center justify-center rounded-md border border-hairline text-text-tertiary transition-colors hover:bg-surface-raised hover:text-error md:min-h-0 md:min-w-0"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );

  const shareForm = isOwner && shareOpen && (
    <form
      id={`${idPrefix}-share`}
      onSubmit={(e) => {
        e.preventDefault();
        onShare();
      }}
      className="flex items-center gap-2"
    >
      <label className="sr-only" htmlFor={inputId}>
        Share 1:1 with
      </label>
      <input
        id={inputId}
        value={shareName}
        onChange={(e) => onShareNameChange(e.target.value)}
        placeholder="@username"
        className="h-10 min-w-0 flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
      />
      <button
        type="submit"
        className={cn(actionBtn, "h-10 bg-surface-raised text-text-primary hover:bg-surface-overlay")}
      >
        Share
      </button>
    </form>
  );

  const bodyEl =
    loading && body === undefined ? (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-32 w-full" />
      </div>
    ) : body === undefined ? (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-well px-4 py-3">
        <p className="text-sm leading-5 text-text-secondary">Couldn&rsquo;t open this note.</p>
        <button
          type="button"
          onClick={onRetryBody}
          className={cn(actionBtn, "bg-surface-raised text-text-primary hover:bg-surface-overlay")}
        >
          Retry
        </button>
      </div>
    ) : (
      <NoteBody md={body} />
    );

  if (variant === "inline") {
    return (
      <div className="mt-3 flex flex-col gap-3">
        {note.fork_from && (
          <p className="text-xs leading-5 text-text-tertiary">
            Forked from @{note.fork_from} — your copy, your edits.
          </p>
        )}
        <div className="rounded-lg border border-hairline bg-well/60 p-3">{bodyEl}</div>
        {actions}
        {shareForm}
        {formError && <p className="text-xs leading-4 text-error">{formError}</p>}
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <header className="flex flex-col gap-3 border-b border-hairline p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="type-title min-w-0 text-text-primary">{note.title}</h2>
          {actions}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {(note.pattern_tags ?? []).map((t) => (
            <PatternChip key={t} label={t} />
          ))}
          <VisibilityTag visibility={note.visibility} boxed />
          {note.problem_slug && (
            <Link
              href={`/practice/${note.problem_slug}`}
              className="group inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-xs border border-hairline bg-surface-raised px-2 font-mono text-xs leading-4 transition-colors hover:border-hairline-strong"
            >
              {problem?.number && <span className="shrink-0 text-text-primary tnum">No. {problem.number}</span>}
              <span className="truncate text-text-tertiary group-hover:text-text-secondary">
                {problem?.title ?? note.problem_slug}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
            </Link>
          )}
          <span className="ml-auto font-mono text-xs leading-4 text-text-tertiary">
            edited {shortAgo(note.updated_at)}
          </span>
        </div>
        {note.fork_from && (
          <p className="text-xs leading-5 text-text-tertiary">
            Forked from @{note.fork_from} — your copy, your edits.
          </p>
        )}
        {shareForm}
        {formError && <p className="text-xs leading-4 text-error">{formError}</p>}
      </header>
      <div className="p-6">
        <div className="max-w-reading">{bodyEl}</div>
      </div>
    </article>
  );
}
