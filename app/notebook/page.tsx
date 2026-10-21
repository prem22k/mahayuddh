"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Copy, Check, Search, GitFork } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MyImpact } from "@/components/impact/MyImpact";
import { PageLoader } from "@/components/ui/PageLoader";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { PatternChip } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { NoteReader, type NoteProblem } from "@/components/notebook/NoteReader";
import { VisibilityTag, shortAgo, visibilityLabel } from "@/components/notebook/noteMeta";
import { getSharedResources } from "@/lib/data/vault";
import { getCatalogBySlugs } from "@/lib/data/problems";
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
import { titleFromSlug } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotebookNoteSummary, SharedResource, NoteVisibility } from "@/types/database";

type Tab = "mine" | "vault" | "shared" | "impact";

/** Stitch filter chip: bordered pill, indigo dot for pattern filters, 44px hit area on mobile. */
function FilterChip({
  label,
  active,
  dot,
  onClick,
}: {
  label: string;
  active: boolean;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="group flex min-h-[44px] shrink-0 items-center md:min-h-0"
    >
      <span
        className={cn(
          "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium leading-4 transition-colors",
          active
            ? "border-hairline-strong bg-surface-overlay text-text-primary"
            : "border-hairline bg-surface text-text-secondary group-hover:bg-surface-raised group-hover:text-text-primary"
        )}
      >
        {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pattern" />}
        {label}
      </span>
    </button>
  );
}

function CountChip({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-xs px-1.5 font-mono text-[11px] leading-4 tnum",
        active ? "bg-surface-raised text-text-secondary" : "bg-well text-text-tertiary"
      )}
    >
      ({n})
    </span>
  );
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
  const [bodyRetry, setBodyRetry] = useState(0);
  // Linked-problem number + title for notes that carry a problem_slug. Purely
  // decorative lookups: a failed fetch falls back to the slug-derived title.
  const [problems, setProblems] = useState<Record<string, NoteProblem>>({});

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

  useEffect(() => {
    const slugs = Array.from(
      new Set([...notes, ...shared].map((n) => n.problem_slug).filter((s): s is string => !!s))
    );
    if (slugs.length === 0) return;
    let cancelled = false;
    getCatalogBySlugs(slugs)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, NoteProblem> = {};
        for (const r of rows) map[r.title_slug] = { number: r.question_id || null, title: r.title };
        setProblems(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [notes, shared]);

  const problemFor = (slug: string | null): NoteProblem | null =>
    slug ? (problems[slug.toLowerCase()] ?? { number: null, title: titleFromSlug(slug) }) : null;

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
  }, [selected, bodyCache, bodyRetry]);

  const selectNote = (id: string) => {
    setSelectedId(id);
    // Below lg the reader expands inside the tapped card: keep its top in view.
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() =>
        document.getElementById(`note-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  if (loading) return <PageLoader label="Loading notebook..." />;

  const tabs: { id: Tab; label: React.ReactNode; count?: number }[] = [
    { id: "mine", label: "My notes", count: notes.length },
    { id: "vault", label: "Vault" },
    {
      id: "shared",
      label: (
        <>
          <span className="md:hidden">Shared</span>
          <span className="hidden md:inline">Shared with me</span>
        </>
      ),
      count: shared.length,
    },
    { id: "impact", label: "Impact" },
  ];

  const newNoteButton = (
    <Button
      variant="primary"
      onClick={() => {
        openNew();
        setShowEditor(true);
      }}
      className="min-h-[44px] shrink-0 font-semibold md:min-h-0"
    >
      <Plus className="h-4 w-4" strokeWidth={1.5} />
      New note
    </Button>
  );

  const searchField = (
    <label className="relative block min-w-0 flex-1 lg:w-72 lg:flex-none">
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
  );

  const noteReaderProps = (n: NotebookNoteSummary) => ({
    note: n,
    body: bodyCache[n.id],
    loading: selectedLoading,
    problem: problemFor(n.problem_slug),
    isOwner: user?.id === n.owner_id,
    onEdit: () => {
      openEdit(n);
      setShowEditor(true);
    },
    onDelete: async () => {
      if (window.confirm("Delete this note?")) {
        await deleteNote(n.id);
        setSelectedId(null);
        setBodyCache({});
        await load();
      }
    },
    onRetryBody: () => setBodyRetry((r) => r + 1),
    shareName,
    onShareNameChange: setShareName,
    onShare: () => handleShare(n.id),
    formError,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Heading row: title + count and tabs on the left, search + the one
          gold action on the right (desktop); search row below tabs on mobile. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:border-b lg:border-hairline">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="type-display-md text-text-primary">Notebook</h1>
            <span className="rounded-xs border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-xs font-medium leading-4 tracking-[0.06em] text-text-tertiary tnum">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Notebook sections"
            className="-mx-4 flex gap-6 overflow-x-auto px-4 [box-shadow:inset_0_-1px_0_theme(colors.hairline)] [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 lg:[box-shadow:none]"
          >
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium leading-5 transition-colors",
                    active
                      ? "border-text-primary text-text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary"
                  )}
                >
                  {t.label}
                  {t.count != null && <CountChip n={t.count} active={active} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 lg:pb-3">
          {tab === "mine" ? searchField : <span className="flex-1 lg:hidden" />}
          {newNoteButton}
        </div>
      </div>

      {loadError && <ErrorCard message={loadError} onRetry={load} />}

      {tab === "mine" && (
        <div className="flex flex-col gap-4">
          {patternOptions.length > 1 && (
            <div
              role="group"
              aria-label="Filter notes by pattern"
              className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
            >
              <span className="mr-1 hidden font-mono text-xs font-medium leading-4 text-text-tertiary md:inline">
                Filter
              </span>
              {patternOptions.map((o) => (
                <FilterChip
                  key={o}
                  label={o === "All" ? `All (${notes.length})` : o}
                  active={patternFilter === o}
                  dot={o !== "All"}
                  onClick={() => setPatternFilter(o)}
                />
              ))}
            </div>
          )}

          {notes.length === 0 ? (
            <EmptyState
              heading="Your notebook is empty"
              body="Write what a problem taught you — or copy a squad template and make it yours."
              action={
                <Button
                  variant="secondary"
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
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <ul className="flex flex-col gap-2">
                {filteredNotes.map((n) => {
                  const active = n.id === selectedId;
                  const problem = problemFor(n.problem_slug);
                  const tag = (n.pattern_tags ?? [])[0];
                  return (
                    <li key={n.id} id={`note-${n.id}`} className="scroll-mt-20">
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-xl border transition-colors",
                          active
                            ? "border-hairline-strong bg-surface-raised lg:bg-surface-overlay"
                            : "border-hairline bg-surface hover:bg-surface-raised"
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute inset-x-0 top-0 h-0.5 bg-pattern lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[3px]"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => selectNote(n.id)}
                          aria-current={active}
                          aria-expanded={active}
                          className="block min-h-[44px] w-full px-3.5 pb-3 pt-3.5 text-left"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "min-w-0 text-[15px] font-semibold leading-[22px] tracking-[-0.01em]",
                                active ? "text-text-primary" : "text-text-secondary"
                              )}
                            >
                              {n.title}
                            </span>
                            {n.fork_from ? (
                              <GitFork className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                            ) : (
                              <span className="shrink-0 font-mono text-[11px] leading-5 text-text-tertiary lg:hidden">
                                {shortAgo(n.updated_at)}
                              </span>
                            )}
                          </span>
                          {problem && (
                            <span className="mt-1 block truncate text-xs leading-4 text-text-tertiary">
                              {problem.number && <span className="font-mono tnum">No. {problem.number} · </span>}
                              {problem.title}
                            </span>
                          )}
                          <span className="mt-2.5 flex items-center justify-between gap-2 lg:mt-3 lg:border-t lg:border-hairline lg:pt-2">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              {tag && <PatternChip label={tag} />}
                              {n.fork_from && (
                                <span className="truncate font-mono text-[11px] leading-4 text-text-tertiary">
                                  Forked from @{n.fork_from}
                                </span>
                              )}
                              <VisibilityTag visibility={n.visibility} className="font-mono text-[11px]" />
                            </span>
                            <span
                              className={cn(
                                "shrink-0 font-mono text-[11px] leading-4 text-text-tertiary",
                                !n.fork_from && "hidden lg:inline"
                              )}
                            >
                              {shortAgo(n.updated_at)}
                            </span>
                          </span>
                        </button>
                        {active && (
                          <div className="px-3.5 pb-3.5 lg:hidden">
                            <NoteReader {...noteReaderProps(n)} idPrefix="note-inline" variant="inline" />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden lg:block">
                {selected ? (
                  <NoteReader {...noteReaderProps(selected)} idPrefix="note-pane" variant="pane" />
                ) : (
                  <div className="rounded-xl border border-hairline bg-surface p-6">
                    <p className="text-sm leading-6 text-text-secondary">Select a note to read it.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "vault" && (
        <div className="flex flex-col gap-4">
          {vaultOptions.length > 1 && (
            <div
              role="group"
              aria-label="Filter vault by category"
              className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
            >
              <span className="mr-1 hidden font-mono text-xs font-medium leading-4 text-text-tertiary md:inline">
                Filter
              </span>
              {vaultOptions.map((o) => (
                <FilterChip
                  key={o}
                  label={o === "All" ? `All (${vault.length})` : o}
                  active={vaultFilter === o}
                  onClick={() => setVaultFilter(o)}
                />
              ))}
            </div>
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
            <ul className="flex flex-col gap-2">
              {filteredVault.slice(0, 30).map((r) => (
                <li
                  key={r.id}
                  className="flex min-h-[56px] flex-col gap-3 rounded-xl border border-hairline bg-surface px-3.5 py-3 transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold leading-[22px] tracking-[-0.01em] text-text-primary">
                      {r.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] leading-4 text-text-tertiary">
                      <span className="rounded-xs border border-hairline bg-well px-1.5 py-0.5 text-text-secondary">
                        {r.category}
                      </span>
                      <span>by @{r.author_profile?.username || "squad"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
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
                    className="inline-flex h-9 min-h-[44px] shrink-0 items-center justify-center gap-1.5 self-start rounded-md border border-hairline bg-surface-raised px-3 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-overlay sm:self-auto md:min-h-0"
                  >
                    {copiedId === r.id ? (
                      <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={1.5} />
                    )}
                    {copiedId === r.id ? "Copied" : "Copy to my notebook"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "shared" && (
        <div className="flex flex-col gap-4">
          {shared.length === 0 ? (
            <EmptyState
              heading="Nothing shared with you yet"
              body="Squad notes and 1:1 shares appear here — with attribution to whoever taught you."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {shared.map((n) => {
                const problem = problemFor(n.problem_slug);
                const owner = n.owner?.username || "squad";
                return (
                  <li key={n.id} className="rounded-xl border border-hairline bg-surface px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-[15px] font-semibold leading-[22px] tracking-[-0.01em] text-text-primary">
                        {n.title}
                      </div>
                      <span className="shrink-0 font-mono text-[11px] leading-5 text-text-tertiary">
                        {shortAgo(n.updated_at)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs leading-4 text-text-tertiary">
                      <span className="inline-flex items-center gap-1.5 text-text-secondary">
                        <Avatar name={owner} src={n.owner?.avatar_url} size="sm" className="h-5 w-5 text-[9px]" />
                        From @{owner}
                      </span>
                      {(n.pattern_tags ?? []).slice(0, 1).map((t) => (
                        <PatternChip key={t} label={t} />
                      ))}
                      <VisibilityTag visibility={n.visibility} />
                      <span>Read-only</span>
                      {problem && n.problem_slug && (
                        <Link
                          href={`/practice/${n.problem_slug}`}
                          className="inline-flex min-h-[44px] items-center font-mono text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0"
                        >
                          {problem.number ? `No. ${problem.number} · ` : ""}
                          {problem.title}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Loop C (§56): does your writing change what anybody does? A fourth tab
          rather than another card, because it is a different question from
          "what have I written". */}
      {tab === "impact" && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">Your impact</h2>
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
              <p className="text-xs leading-5 text-text-tertiary">
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
            <div className="space-y-1.5">
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
              <p className="text-xs leading-4 text-text-tertiary">
                Private by default. Sharing is intentional and reversible.
              </p>
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
