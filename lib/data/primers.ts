import { createClient } from "@/lib/supabase/client";
import { Primer } from "@/types/database";
import { DataError } from "@/lib/data/errors";

const COLUMNS =
  "id, slug, pattern, title, recognize_when, mental_model, template_md, complexity, mistakes, starter_slugs, author_id, visibility, squad_id, created_at";

export async function listPrimers(): Promise<Primer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("primers")
    .select(COLUMNS)
    .order("pattern", { ascending: true });
  if (error) throw new DataError("primers", "Couldn't load primers. Retry.", { cause: error });
  return (data ?? []) as Primer[];
}

export async function getPrimer(slug: string): Promise<Primer | null> {
  const supabase = createClient();
  const { data } = await supabase.from("primers").select(COLUMNS).eq("slug", slug).maybeSingle();
  return (data as Primer | null) ?? null;
}

/** Primers whose pattern matches any of the given topic/category names. */
export function primerReadMinutes(p: {
  recognize_when: string[];
  mental_model: string | null;
  template_md: string | null;
  complexity: string | null;
  mistakes: string[];
}): number {
  // Client-side estimate from content length only. There is no read-time
  // column and no read tracking, so this is labeled as an estimate wherever
  // it renders — never as measured read state.
  const text = [
    ...(p.recognize_when ?? []),
    p.mental_model ?? "",
    p.template_md ?? "",
    p.complexity ?? "",
    ...(p.mistakes ?? []),
  ].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}export async function getPrimersForPatterns(patterns: string[]): Promise<Primer[]> {
  if (patterns.length === 0) return [];
  const supabase = createClient();
  const lowered = patterns.map((p) => p.toLowerCase());
  const { data, error } = await supabase.from("primers").select(COLUMNS);
  if (error) {
    throw new DataError("primers", "Couldn't load primers. Retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("primers", "Couldn't load primers. Retry.");
  }
  // Pattern names are short and controlled; substring match both directions
  // catches "Graphs" ↔ "Graphs (BFS)" style drift without a mapping table.
  return (data as Primer[]).filter((p) => {
    const pat = p.pattern.toLowerCase();
    return lowered.some((t) => t.includes(pat) || pat.includes(t));
  });
}
