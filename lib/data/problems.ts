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

export interface CatalogTopicSummary {
  topic: string;
  count: number;
  solved: number;
  attempted: number;
}

// Fetches slug + topics so the client can aggregate both catalog counts and
// per-topic correctness against a user status map.
export async function getCatalogSlugTopics(): Promise<{ title_slug: string; topics: string[] }[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("problems").select("title_slug, topics");

  if (error || !data) return [];
  return data as { title_slug: string; topics: string[] }[];
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

  if (error) return 0;
  return count ?? 0;
}
