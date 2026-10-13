"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Plus, Copy, Check, Trash2, Pencil, Search } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MyImpact } from "@/components/impact/MyImpact";
import { PageLoader } from "@/components/ui/PageLoader";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { PatternChip } from "@/components/ui/Badge";
import { UnderlineTabs, FilterChips } from "@/components/ui/ProblemRow";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { getSharedResources } from "@/lib/data/vault";
import {
  getMyNotes,
  getSharedWithMe,
  createNote,
  updateNoteBody,
  setNoteVisibility,
  deleteNote,
  shareNoteWith,
  copyVaultToNotebook,
} from "@/lib/data/notebook";
import { dataErrorMessage } from "@/lib/data/errors";
import { NotebookNoteSummary, SharedResource, NoteVisibility } from "@/types/database";

type Tab = "mine" | "vault" | "shared" | "impact";

/** Minimal markdown rendering for note bodies: paragraphs, bullets, code fences. */
function NoteBody({ md }: { md: string }) {
  const parts = md.split("```");
  return (
    <div className="space-y-4">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const lines = part.replace(/^\w+\n/, "").replace(/\n$/, "");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-md border border-hairline bg-well p-4 font-mono text-sm leading-6 text-text-primary"
            >
              <code>{lines}</code>
            </pre>
          );
        }
        const blocks = part.split(/\n{2,}/);
        return (
          <div key={i} className="space-y-3">
            {blocks.map((block, j) => {
              const lines = block.split("\n").filter((l) => l.trim());
              if (lines.length === 0) return null;
              if (lines.every((l) => /^[-*]\s+/.test(l))) {
                return (
                  <ul key={j} className="list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-text-primary">
                    {lines.map((l, k) => (
                      <li key={k}>{l.replace(/^[-*]\s+/, "")}</li>
                    ))}
                  </ul>
                );
              }
              if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
                return (
                  <h3 key={j} className="font-sans text-lg font-semibold leading-7 text-text-primary">
                    {lines[0].replace(/^#{1,3}\s+/, "")}
                  </h3>
                );
              }
              return (
                <p key={j} className="whitespace-pre-wrap text-[15px] leading-6 text-text-primary">
                  {block.trim()}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function visibilityLabel(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export default function NotebookPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [notes, setNotes] = useState<NotebookNoteSummary[]>([]);
  const [shared, setShared] = useState<NotebookNoteSummary[]>([]);
  const [vault, setVault] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editor only needs id/visibility/fork_from/owner_id — all present on the
  // list shape. Body is fetched on open (lib/data/notebook.ts FULL_COLUMNS).
  const [editing, setEditing] = useState<NotebookNoteSummary | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("private");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shareName, setShareName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // List chrome state: search, pattern filter, open note.
  const [query, setQuery] = useState("");
  const [patternFilter, setPatternFilter] = useState("All");
  const [vaultFilter, setVaultFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodyCache, setBodyCache] = useState<Record<string, string>>({});
  const [selectedLoading, setSelectedLoading] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // No per-call .catch(() => []) here: a silent [] would render as
      // "you have no notes" instead of an honest retry (Step 0 hazard 4).
      const [mine, sharedNotes, vaultItems] = await Promise.all([
        getMyNotes(),
        getSharedWithMe(),
        getSharedResources(),
      ]);
      setNotes(mine);
      setShared(sharedNotes);
      setVault(vaultItems);
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load notebook. Retry."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // /vault redirects here (Step 4 + Step 13): deep-link straight to the tab.
  // Read from window in an effect rather than useSearchParams, which would
  // force the whole page behind a Suspense boundary during static prerender.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "vault") {
      setTab("vault");
    }
  }, []);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setVisibility("private");
    setFormError(null);
  };

  const openEdit = async (n: NotebookNoteSummary) => {
    setEditing(n);
    setTitle(n.title);
    setVisibility(n.visibility);
    setFormError(null);
    // Body excluded from list views (§65): fetch full note on open.
    const { getNoteById } = await import("@/lib/data/notebook");
    const full = await getNoteById(n.id).catch(() => null);
    setBody(full?.body_md ?? "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (visibility === "squad" && !profile?.active_squad_id) {
      setFormError("Join or activate a squad first to share with a squad.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateNoteBody(editing.id, body);
        if (editing.visibility !== visibility) {
          await setNoteVisibility(editing.id, visibility, profile?.active_squad_id ?? null);
        }
      } else {
        await createNote({ title, bodyMd: body, visibility, squadId: profile?.active_squad_id ?? null });
      }
      setEditing(null);
      setTitle("");
      setBody("");
      setBodyCache({});
      await load();
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't save note."));
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async (noteId: string) => {
    if (!shareName.trim()) return;
    try {
      await shareNoteWith(noteId, shareName);
      setShareName("");
      setFormError(null);
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't share."));
    }
  };

  const [showEditor, setShowEditor] = useState(false);

  const patternOptions = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach((n) => (n.pattern_tags ?? []).forEach((t) => tags.add(t)));
    return ["All", ...Array.from(tags)];
  }, [notes]);

  const vaultOptions = useMemo(() => {
    const cats = new Set(vault.map((r) => r.category));
    return ["All", ...Array.from(cats)];
  }, [vault]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (patternFilter !== "All" && !(n.pattern_tags ?? []).includes(patternFilter)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        (n.problem_slug ?? "").toLowerCase().includes(q) ||
        (n.pattern_tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, query, patternFilter]);

  const filteredVault = useMemo(
    () => (vaultFilter === "All" ? vault : vault.filter((r) => r.category === vaultFilter)),
    [vault, vaultFilter]
  );

  // Default to the first note open, per the two-pane spec.
  useEffect(() => {
    if (!selectedId && filteredNotes.length > 0) {
      setSelectedId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedId]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected || bodyCache[selected.id] !== undefined) return;
    let cancelled = false;
    setSelectedLoading(true);
    import("@/lib/data/notebook").then(({ getNoteById }) =>
      getNoteById(selected.id)
        .then((full) => {
          if (cancelled) return;
          setBodyCache((c) => ({ ...c, [selected.id]: full?.body_md ?? "" }));
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSelectedLoading(false);
        })
    );
    return () => {
      cancelled = true;
    };
  }, [selected, bodyCache]);

  const selectNote = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => noteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  if (loading) return <PageLoader label="Loading notebook..." />;

  const tabLabels = [
    `My notes (${notes.length})`,
    "Vault",
    `Shared with me (${shared.length})`,
    "Impact",
  ] as const;
  const tabIds: Tab[] = ["mine", "vault", "shared", "impact"];
  const activeLabel = tabLabels[tabIds.indexOf(tab)];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="type-display-md text-text-primary">Notebook</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Private by default. Sharing is intentional and reversible.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            openNew();
            setShowEditor(true);
          }}
          className="min-h-[44px] self-start md:min-h-0 md:self-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New note
        </Button>
      </div>

      <UnderlineTabs
        tabs={tabLabels}
        value={activeLabel}
        onChange={(label) => setTab(tabIds[tabLabels.indexOf(label as (typeof tabLabels)[number])])}
      />

      {loadError && <ErrorCard message={loadError} onRetry={load} />}

      {tab === "mine" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                strokeWidth={1.5}
              />
              <span className="sr-only">Search your notes</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notes"
                className="h-10 w-full rounded-md border border-hairline bg-well pl-9 pr-3 text-sm leading-5 text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
              />
            </label>
            {patternOptions.length > 1 && (
              <FilterChips options={patternOptions} value={patternFilter} onChange={setPatternFilter} />
            )}
          </div>

          {notes.length === 0 ? (
            <EmptyState
              heading="Your notebook is empty"
              body="Write what a problem taught you — or copy a squad template and make it yours."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    openNew();
                    setShowEditor(true);
                  }}
                >
                  Write the first note
                </Button>
              }
            />
          ) : filteredNotes.length === 0 ? (
            <EmptyState
              heading="Nothing matches that filter"
              body="Try a different search, or clear the pattern filter."
              action={
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setPatternFilter("All");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
              <ul className="space-y-2">
                {filteredNotes.map((n) => {
                  const active = n.id === selectedId;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => selectNote(n.id)}
                        aria-current={active}
                        className={`flex min-h-[44px] w-full items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                          active
                            ? "border-hairline-strong bg-surface-overlay"
                            : "border-hairline bg-surface hover:bg-surface-raised"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium leading-5 text-text-primary">
                            {n.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2">
                            {(n.pattern_tags ?? []).slice(0, 1).map((t) => (
                              <PatternChip key={t} label={t} />
                            ))}
                            <span className="text-xs leading-4 text-text-tertiary">
                              {visibilityLabel(n.visibility)}
                            </span>
                            {n.fork_from && (
                              <span className="text-xs italic leading-4 text-text-tertiary">
                                Forked from @{n.fork_from}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-text-tertiary">
                          {new Date(n.updated_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div ref={noteRef} className="card scroll-mt-20">
                {!selected ? (
                  <p className="text-sm leading-6 text-text-secondary">Select a note to read it.</p>
                ) : (
                  <article>
                    <h2 className="type-title text-text-primary">{selected.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {(selected.pattern_tags ?? []).map((t) => (
                        <PatternChip key={t} label={t} />
                      ))}
                      <span className="text-xs leading-4 text-text-tertiary">
                        {visibilityLabel(selected.visibility)}
                      </span>
                      {selected.problem_slug && (
                        <Link
                          href={`/practice/${selected.problem_slug}`}
                          className="font-mono text-xs text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary"
                        >
                          No. {selected.problem_slug}
                        </Link>
                      )}
                      <span className="text-xs leading-4 text-text-tertiary">
                        Edited{" "}
                        {new Date(selected.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    {selected.fork_from && (
                      <p className="mt-2 text-xs italic leading-5 text-text-tertiary">
                        Forked from @{selected.fork_from} — your copy, your edits.
                      </p>
                    )}
                    <div className="my-4 h-px bg-hairline" />
                    {selectedLoading && bodyCache[selected.id] === undefined ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    ) : (
                      <NoteBody md={bodyCache[selected.id] ?? ""} />
                    )}
                    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          openEdit(selected);
                          setShowEditor(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                        Edit
                      </Button>
                      {user?.id === selected.owner_id && (
                        <span className="flex min-h-[44px] items-center gap-2 md:min-h-0">
                          <label className="sr-only" htmlFor="note-share-user">
                            Share 1:1 with
                          </label>
                          <input
                            id="note-share-user"
                            value={shareName}
                            onChange={(e) => setShareName(e.target.value)}
                            placeholder="Share 1:1 with @username"
                            className="h-10 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
                          />
                          <Button variant="ghost" onClick={() => handleShare(selected.id)}>
                            Share
                          </Button>
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        aria-label="Delete note"
                        onClick={async () => {
                          if (window.confirm("Delete this note?")) {
                            await deleteNote(selected.id);
                            setSelectedId(null);
                            setBodyCache({});
                            await load();
                          }
                        }}
                        className="text-text-tertiary hover:text-error"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                    {formError && <p className="mt-2 text-xs leading-4 text-error">{formError}</p>}
                  </article>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "vault" && (
        <div className="space-y-4">
          {vaultOptions.length > 1 && (
            <FilterChips options={vaultOptions} value={vaultFilter} onChange={setVaultFilter} />
          )}
          {vault.length === 0 ? (
            <EmptyState
              heading="Vault is empty"
              body="Shared templates and guides from the squad will land here."
            />
          ) : filteredVault.length === 0 ? (
            <EmptyState
              heading="Nothing in that category"
              body="Try a different vault filter."
              action={
                <Button variant="ghost" onClick={() => setVaultFilter("All")}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {filteredVault.slice(0, 30).map((r) => (
                <li
                  key={r.id}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium leading-5 text-text-primary">{r.title}</div>
                    <div className="mt-0.5 text-xs leading-4 text-text-tertiary">
                      {r.category} · by @{r.author_profile?.username || "squad"}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await copyVaultToNotebook(r.id);
                        setCopiedId(r.id);
                        setTimeout(() => setCopiedId(null), 2000);
                        await load();
                      } catch {
                        // logged-out: vault rows still stay readable
                      }
                    }}
                    title="Private editable copy with attribution"
                    className="shrink-0"
                  >
                    {copiedId === r.id ? (
                      <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={1.5} />
                    )}
                    {copiedId === r.id ? "Copied" : "Copy to my notebook"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "shared" && (
        <div className="space-y-4">
          {shared.length === 0 ? (
            <EmptyState
              heading="Nothing shared with you yet"
              body="Squad notes and 1:1 shares appear here — with attribution to whoever taught you."
            />
          ) : (
            <ul className="space-y-2">
              {shared.map((n) => (
                <li key={n.id} className="rounded-lg border border-hairline bg-surface px-4 py-3">
                  <div className="text-sm font-medium leading-5 text-text-primary">{n.title}</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-tertiary">
                    From @{n.owner?.username || "squad"} · {visibilityLabel(n.visibility)} · Read-only
                    {n.problem_slug && (
                      <span>
                        {" · "}
                        <Link
                          href={`/practice/${n.problem_slug}`}
                          className="font-mono text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary"
                        >
                          {n.problem_slug}
                        </Link>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Loop C (§56): does your writing change what anybody does? A fourth tab
          rather than another card, because it is a different question from
          "what have I written". */}
      {tab === "impact" && (
        <section className="space-y-3">
          <div>
            <h2 className="font-sans text-lg font-semibold leading-7 text-text-primary">Your impact</h2>
            <p className="mt-0.5 text-sm leading-6 text-text-secondary">
              Who copied what you wrote, and whether they went on to solve it.
            </p>
          </div>
          <MyImpact />
        </section>
      )}

      {showEditor && (
        <ModalShell label={editing ? "Edit note" : "New note"} onClose={() => setShowEditor(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="type-title text-text-primary">{editing ? "Edit note" : "New note"}</h3>
            {editing?.fork_from && (
              <p className="text-xs italic leading-5 text-text-tertiary">
                Forked from @{editing.fork_from} — your copy, your edits.
              </p>
            )}
            {formError && (
              <p role="alert" className="text-sm leading-5 text-error">
                {formError}
              </p>
            )}
            <div>
              <label htmlFor="note-title" className="mb-1 block text-sm font-medium leading-5 text-text-primary">
                Title
              </label>
              <input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What did this teach you?"
                maxLength={120}
                required
                className="h-10 w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="note-body" className="mb-1 block text-sm font-medium leading-5 text-text-primary">
                Note
              </label>
              <textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Markdown: what did you learn? Code fences welcome."
                className="w-full resize-y rounded-md border border-hairline bg-well p-3 font-mono text-sm leading-6 text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
              />
            </div>
            <div
              role="group"
              aria-label="Visibility"
              className="flex h-9 w-fit items-center gap-1 rounded-md border border-hairline bg-well p-1"
            >
              {(["private", "squad", "public"] as NoteVisibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={visibility === v}
                  onClick={() => setVisibility(v)}
                  className={`flex h-full min-h-[44px] items-center rounded-sm px-3 text-sm font-medium leading-5 transition-colors md:min-h-0 ${
                    visibility === v ? "bg-surface-overlay text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {visibilityLabel(v)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" loading={saving}>
                {editing ? "Save changes" : "Save note"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowEditor(false)}>
                Cancel
              </Button>
            </div>
            {editing && user?.id === editing.owner_id && (
              <div className="flex items-center gap-2 border-t border-hairline pt-4">
                <label htmlFor="note-share-editor" className="sr-only">
                  Share 1:1 with
                </label>
                <input
                  id="note-share-editor"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                  placeholder="Share 1:1 with @username"
                  className="h-10 flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
                />
                <Button type="button" variant="secondary" onClick={() => handleShare(editing.id)}>
                  Share
                </Button>
              </div>
            )}
          </form>
        </ModalShell>
      )}
    </div>
  );
}
