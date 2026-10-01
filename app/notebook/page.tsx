"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Copy, Check, Trash2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { ModalShell } from "@/components/ui/ModalShell";
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

type Tab = "mine" | "vault" | "shared";

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
      await load();
    } catch (err) {
      setFormError(dataErrorMessage(err, "Couldn't save note."));
    } finally {
      setSaving(false);
    }
  };

  const [showEditor, setShowEditor] = useState(false);

  if (loading) return <PageLoader label="Loading notebook..." />;

  return (
    <div className="space-y-6 select-none max-w-3xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>What do I know?</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Notebook</h1>
          <p className="text-xs text-white/40 mt-1">Private by default. Sharing is intentional and reversible.</p>
        </div>
        <button onClick={() => { openNew(); setShowEditor(true); }}
          className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start md:self-auto">
          <Plus className="w-3.5 h-3.5" />
          <span>New note</span>
        </button>
      </div>

      <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit">
        {(["mine", "vault", "shared"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
              tab === t ? "bg-white/[0.12] text-white shadow-sm" : "text-white/40 hover:text-white/80")}>
            {t === "mine" ? `My Notes (${notes.length})` : t === "vault" ? "Vault" : `Shared with me (${shared.length})`}
          </button>
        ))}
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
          <span className="text-xs text-[#ff453a] font-medium">{loadError}</span>
          <button onClick={load} className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 text-[#ff453a] text-xs font-bold cursor-pointer shrink-0">Retry</button>
        </div>
      )}

      {tab === "mine" && (
        notes.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
            <p className="text-sm font-bold text-white">Your notebook is empty.</p>
            <p className="text-xs text-white/40">Write what a problem taught you — or copy a squad template and make it yours.</p>
            <button onClick={() => { openNew(); setShowEditor(true); }} className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold cursor-pointer">Write the first note</button>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                <button onClick={() => { openEdit(n); setShowEditor(true); }} className="text-left flex-1 min-w-0 cursor-pointer">
                  <div className="text-sm font-bold text-white truncate">{n.title}</div>
                  <div className="text-[10px] text-white/30 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="uppercase">{n.visibility}</span>
                    {n.problem_slug && <Link href={`/practice/${n.problem_slug}`} onClick={(e) => e.stopPropagation()} className="text-[#fa586a] hover:underline font-mono">{n.problem_slug}</Link>}
                    {n.fork_from && <span className="italic">Forked from @{n.fork_from}</span>}
                  </div>
                </button>
                <button onClick={async () => { if (window.confirm("Delete this note?")) { await deleteNote(n.id); await load(); } }}
                  className="p-2 rounded-full text-white/30 hover:text-[#ff453a] cursor-pointer" title="Delete note">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "vault" && (
        vault.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
            <p className="text-sm font-bold text-white">Vault is empty.</p>
            <p className="text-xs text-white/40">Shared templates and guides from the squad will land here.</p>
            <Link href="/vault" className="inline-block px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold">Open full vault</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {vault.slice(0, 30).map((r) => (
              <div key={r.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{r.title}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{r.category} · by @{r.author_profile?.username || "squad"}</div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await copyVaultToNotebook(r.id);
                      setCopiedId(r.id);
                      setTimeout(() => setCopiedId(null), 2000);
                      await load();
                    } catch {
                      // logged-out: vault page still allows reading
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/80 text-[11px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Private editable copy with attribution"
                >
                  {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === r.id ? "Copied!" : "Copy to my notebook"}</span>
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "shared" && (
        shared.length === 0 ? (
          <div className="p-12 text-center space-y-2 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
            <p className="text-sm font-bold text-white">Nothing shared with you yet.</p>
            <p className="text-xs text-white/40">Squad notes and 1:1 shares appear here — with attribution to whoever taught you.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shared.map((n) => (
              <div key={n.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-sm font-bold text-white">{n.title}</div>
                <div className="text-[10px] text-white/30 mt-0.5">
                  by @{n.owner?.username || "squad"} · {n.visibility}
                  {n.problem_slug && <span> · <Link href={`/practice/${n.problem_slug}`} className="text-[#fa586a] hover:underline font-mono">{n.problem_slug}</Link></span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showEditor && (
        <ModalShell label={editing ? "Edit note" : "New note"} onClose={() => setShowEditor(false)}>
          <form onSubmit={handleSave} className="space-y-4 p-1">
            <h3 className="text-base font-bold text-white">{editing ? "Edit note" : "New note"}</h3>
            {editing?.fork_from && <p className="text-[11px] text-white/40 italic">Forked from @{editing.fork_from} — your copy, your edits.</p>}
            {formError && <div className="text-xs text-[#ff453a]">{formError}</div>}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} required
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
              placeholder="Markdown: what did you learn? Code fences welcome."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 resize-y font-mono" />
            <div className="flex items-center gap-2 flex-wrap">
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as NoteVisibility)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white cursor-pointer">
                <option value="private">Private (default)</option>
                <option value="squad">Squad</option>
                <option value="public">Public</option>
              </select>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-full bg-[#fa586a] text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer">
                {saving ? "Saving…" : editing ? "Save changes" : "Save note"}
              </button>
            </div>
            {editing && user?.id === editing.owner_id && (
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <input value={shareName} onChange={(e) => setShareName(e.target.value)} placeholder="Share 1:1 with @username"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60" />
                <button type="button" onClick={async () => {
                  if (!shareName.trim()) return;
                  try {
                    await shareNoteWith(editing.id, shareName);
                    setShareName("");
                    setFormError(null);
                  } catch (err) {
                    setFormError(dataErrorMessage(err, "Couldn't share."));
                  }
                }} className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-[11px] font-bold cursor-pointer">
                  Share
                </button>
              </div>
            )}
          </form>
        </ModalShell>
      )}
    </div>
  );
}
