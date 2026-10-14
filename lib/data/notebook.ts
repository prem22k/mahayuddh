import { createClient } from "@/lib/supabase/client";
import { findProfileByUsername } from "@/lib/profiles/username";
import { NotebookNote, NotebookNoteSummary, NoteVisibility } from "@/types/database";
import { DataError } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

// List views exclude body_md (Bible §65: keep lists lightweight).
const LIST_COLUMNS =
  "id, owner_id, folder, pattern_tags, problem_slug, title, visibility, squad_id, fork_of, fork_from, created_at, updated_at";
const FULL_COLUMNS = `${LIST_COLUMNS}, body_md`;

export async function getMyNotes(): Promise<NotebookNoteSummary[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("notebook_notes")
    .select(LIST_COLUMNS)
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new DataError("notebook", "Couldn't load your notes. Retry.", { cause: error });
  return (data ?? []) as NotebookNoteSummary[];
}

export async function getSharedWithMe(): Promise<NotebookNoteSummary[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // 1:1 shares + squad-visible notes from others (RLS scopes both).
  const [{ data: shares }, { data: notes, error }] = await Promise.all([
    supabase.from("note_shares").select("note_id").eq("shared_with", user.id),
    supabase
      .from("notebook_notes")
      .select(`${LIST_COLUMNS}, owner:owner_id (id, username, avatar_url)`)
      .neq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new DataError("notebook", "Couldn't load shared notes. Retry.", { cause: error });
  const sharedIds = new Set((shares ?? []).map((s) => (s as { note_id: string }).note_id));
  // Embedded `owner:owner_id (...)` widens to an array under the generated types.
  return ((notes ?? []) as unknown as NotebookNoteSummary[]).filter(
    (n) => n.visibility === "public" || n.visibility === "squad" || sharedIds.has(n.id)
  );
}

export async function getNoteById(id: string): Promise<NotebookNote | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notebook_notes")
    .select(`${FULL_COLUMNS}, owner:owner_id (id, username, avatar_url)`)
    .eq("id", id)
    .maybeSingle();
  return (data as NotebookNote | null) ?? null;
}

export async function createNote(params: {
  title: string;
  bodyMd: string;
  folder?: string;
  patternTags?: string[];
  problemSlug?: string | null;
  visibility?: NoteVisibility;
  squadId?: string | null;
  forkOf?: string | null;
  forkFrom?: string | null;
}): Promise<NotebookNote> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new DataError("notebook", "Log in to save notes.");
  const title = params.title.trim().slice(0, 120);
  if (!title) throw new DataError("notebook", "Title is required.");
  if (!params.bodyMd.trim()) throw new DataError("notebook", "Write something first.");
  const { data, error } = await supabase
    .from("notebook_notes")
    .insert({
      owner_id: user.id,
      title,
      body_md: params.bodyMd.slice(0, 50000),
      folder: params.folder?.trim() || null,
      pattern_tags: (params.patternTags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10),
      problem_slug: params.problemSlug?.toLowerCase() || null,
      visibility: params.visibility ?? "private",
      squad_id: params.visibility === "squad" ? (params.squadId ?? null) : null,
      fork_of: params.forkOf ?? null,
      fork_from: params.forkFrom ?? null,
    })
    .select(FULL_COLUMNS)
    .maybeSingle();
  if (error || !data) throw new DataError("notebook", "Couldn't save note. Try again.", { cause: error });
  return data as NotebookNote;
}

export async function updateNoteBody(id: string, bodyMd: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notebook_notes")
    .update({ body_md: bodyMd.slice(0, 50000), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new DataError("notebook", "Couldn't save note. Try again.", { cause: error });
}

export async function setNoteVisibility(id: string, visibility: NoteVisibility, squadId?: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notebook_notes")
    .update({ visibility, squad_id: visibility === "squad" ? (squadId ?? null) : null })
    .eq("id", id);
  if (error) throw new DataError("notebook", "Couldn't change sharing. Try again.", { cause: error });
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notebook_notes").delete().eq("id", id);
  if (error) throw new DataError("notebook", "Couldn't delete note. Try again.", { cause: error });
}

/** 1:1 share (no public publish needed). Owner-only. */
export async function shareNoteWith(noteId: string, username: string, canEdit = false): Promise<void> {
  const supabase = createClient();
  // Case-insensitive, because "@Prem Sai" and "@prem sai" are the same member
  // and the error message used to contradict that.
  const target = await findProfileByUsername(supabase, username);
  if (!target) throw new DataError("notebook", `No member named @${username.trim()}.`);
  const { error } = await supabase
    .from("note_shares")
    .upsert({ note_id: noteId, shared_with: target.id, can_edit: canEdit }, { onConflict: "note_id,shared_with" });
  if (error) throw new DataError("notebook", "Couldn't share note. Try again.", { cause: error });
}

// COPY TO MY NOTEBOOK: private editable copy preserving attribution (Bible §47).
async function copyToNotebook(params: {
  title: string;
  bodyMd: string;
  patternTags?: string[];
  problemSlug?: string | null;
  forkOf: string;
  forkFrom: string;
}): Promise<NotebookNote> {
  const note = await createNote({
    title: params.title.slice(0, 120),
    bodyMd: params.bodyMd,
    patternTags: params.patternTags,
    problemSlug: params.problemSlug,
    visibility: "private",
    forkOf: params.forkOf,
    forkFrom: params.forkFrom,
  });
  track("note_copied", { fork_of: params.forkOf });
  return note;
}

export async function copyVaultToNotebook(resourceId: string): Promise<NotebookNote> {
  const supabase = createClient();
  const { data } = await supabase
    .from("shared_resources")
    .select("*, author_profile:author_id (username)")
    .eq("id", resourceId)
    .maybeSingle();
  if (!data) throw new DataError("notebook", "Resource not found.");
  const r = data as { id: string; title: string; content: string; author_profile?: { username: string } };
  return copyToNotebook({
    title: r.title,
    bodyMd: r.content,
    forkOf: r.id,
    forkFrom: r.author_profile?.username ?? "vault",
  });
}

export async function copyApproachToNotebook(approachId: string): Promise<NotebookNote> {
  const supabase = createClient();
  const { data } = await supabase
    .from("approaches")
    .select("*, author:user_id (username)")
    .eq("id", approachId)
    .maybeSingle();
  if (!data) throw new DataError("notebook", "Approach not found.");
  const a = data as {
    id: string; problem_slug: string; pattern: string | null; core_idea: string;
    complexity_time: string | null; complexity_space: string | null;
    author?: { username: string };
  };
  const body = `${a.core_idea}\n\n${a.complexity_time || a.complexity_space ? `Complexity: ${a.complexity_time || "?"} / ${a.complexity_space || "?"}` : ""}`.trim();
  return copyToNotebook({
    title: `Approach: ${a.problem_slug}`,
    bodyMd: body,
    patternTags: a.pattern ? [a.pattern] : [],
    problemSlug: a.problem_slug,
    forkOf: a.id,
    forkFrom: a.author?.username ?? "squad",
  });
}

export async function copyPrimerToNotebook(primerSlug: string): Promise<NotebookNote> {
  const supabase = createClient();
  const { data } = await supabase.from("primers").select("*").eq("slug", primerSlug).maybeSingle();
  if (!data) throw new DataError("notebook", "Primer not found.");
  const p = data as {
    id: string; slug: string; pattern: string; title: string; recognize_when: string[];
    mental_model: string | null; template_md: string | null; complexity: string | null; mistakes: string[];
  };
  const body = [
    `# ${p.title}`,
    "",
    "## Recognize it when",
    ...p.recognize_when.map((r) => `- ${r}`),
    "",
    "## Mental model",
    p.mental_model || "",
    "",
    "## Template",
    p.template_md || "",
    "",
    `## Complexity\n${p.complexity || ""}`,
    "",
    "## Common mistakes",
    ...p.mistakes.map((m) => `- ${m}`),
  ].join("\n");
  return copyToNotebook({
    title: p.title,
    bodyMd: body,
    patternTags: [p.pattern],
    forkOf: p.id,
    forkFrom: "Mahayuddh primers",
  });
}

/** How many private copies exist of a source (fork count, computed live). */
export async function getForkCount(sourceId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notebook_notes")
    .select("id", { count: "exact", head: true })
    .eq("fork_of", sourceId);
  return count ?? 0;
}


