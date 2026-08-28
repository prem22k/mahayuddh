import { createClient } from "@/lib/supabase/client";
import { Problem, TriState } from "@/types/database";

export async function getAllCatalogProblems(): Promise<Problem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("question_id", { ascending: true });

  if (error || !data) return [];
  return data as Problem[];
}

export async function getCatalogBySlugs(slugs: string[]): Promise<Problem[]> {
  if (slugs.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .in("title_slug", slugs);

  if (error || !data) return [];
  return data as Problem[];
}

export async function getProblemsByTopic(topic: string): Promise<Problem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .contains("topics", [topic])
    .order("question_id", { ascending: true });

  if (error || !data) return [];
  return data as Problem[];
}

export async function searchCatalogProblems(query: string, limit = 50): Promise<Problem[]> {
  if (!query.trim()) return [];
  const supabase = createClient();
  const clean = query.trim().toLowerCase();

  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .or(`title.ilike.%${clean}%,title_slug.ilike.%${clean}%,question_id.eq.${clean}`)
    .limit(limit);

  if (error || !data) return [];
  return data as Problem[];
}

export interface CatalogTopicSummary {
  topic: string;
  count: number;
  solved: number;
  attempted: number;
}

import { CURATED_SHEETS } from "@/lib/data/curatedSheetsData";

// Fetches slug + topics so the client can aggregate both catalog counts and
// per-topic correctness against a user status map.
export async function getCatalogSlugTopics(): Promise<{ title_slug: string; topics: string[] }[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("problems").select("title_slug, topics");

  if (!error && data && data.length > 0) {
    return data as { title_slug: string; topics: string[] }[];
  }

  // Fallback: derive topics from curated sheets if catalog sync hasn't run yet
  const slugToTopics = new Map<string, Set<string>>();
  for (const sheet of CURATED_SHEETS) {
    for (const p of sheet.problems) {
      if (!slugToTopics.has(p.title_slug)) {
        slugToTopics.set(p.title_slug, new Set());
      }
      if (p.category) {
        slugToTopics.get(p.title_slug)!.add(p.category);
      }
    }
  }

  return Array.from(slugToTopics.entries()).map(([title_slug, topicsSet]) => ({
    title_slug,
    topics: Array.from(topicsSet),
  }));
}

export async function getCatalogTopicsSummary(
  statusMap?: Record<string, TriState>
): Promise<CatalogTopicSummary[]> {
  const rows = await getCatalogSlugTopics();
  const counts = new Map<string, { count: number; solved: number; attempted: number }>();

  for (const row of rows) {
    const st = statusMap?.[row.title_slug];
    for (const t of row.topics || []) {
      const agg = counts.get(t) ?? { count: 0, solved: 0, attempted: 0 };
      agg.count += 1;
      if (st === "solved") agg.solved += 1;
      else if (st === "attempted") agg.attempted += 1;
      counts.set(t, agg);
    }
  }

  return Array.from(counts.entries())
    .map(([topic, c]) => ({ topic, count: c.count, solved: c.solved, attempted: c.attempted }))
    .sort((a, b) => b.count - a.count);
}

export async function getCatalogCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("problems")
    .select("*", { count: "exact", head: true });

  if (!error && typeof count === "number" && count > 0) {
    return count;
  }

  // Fallback count from unique curated problems
  const unique = new Set(CURATED_SHEETS.flatMap((s) => s.problems.map((p) => p.title_slug)));
  return unique.size;
}
