import { createClient } from "@/lib/supabase/client";
import { normalizeSlugList } from "@/lib/slug";
import { Problem, TriState } from "@/types/database";
import { DataError } from "@/lib/data/errors";

// PostgREST caps .in() lists and default selects at ~1000 rows; chunk / paginate
// explicitly so the ~3.4k-row catalog never silently truncates.
const CATALOG_PAGE_SIZE = 1000;
const MAX_CATALOG_ROWS = 5000;
const MAX_SLUGS_PER_LOOKUP = 1000;
const IN_CHUNK = 200;

export async function getCatalogBySlugs(slugs: string[]): Promise<Problem[]> {
  const unique = normalizeSlugList(slugs, MAX_SLUGS_PER_LOOKUP);
  if (unique.length === 0) return [];
  const supabase = createClient();
  const rows: Problem[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const slice = unique.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase.from("problems").select("*").in("title_slug", slice);
    // A failed chunk would silently drop 200 problems from the result. Throw so
    // callers surface a retry instead of rendering an incomplete list (Step 0).
    if (error) {
      throw new DataError("catalog", "Couldn't load those problems. Retry.", { cause: error });
    }
    if (!data) {
      throw new DataError("catalog", "Couldn't load those problems. Retry.");
    }
    rows.push(...(data as Problem[]));
  }
  return rows;
}

// Escape LIKE wildcards so a query like "100%_done" matches literally instead
// of acting as a wildcard scan. Backslash first to avoid double-escaping.
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function searchCatalogProblems(query: string, limit = 50): Promise<Problem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const raw = query.trim().slice(0, 100);
  if (!raw) return [];
  // Strip PostgREST `or=` structural chars ( , ( ) " ' ; . ) that would break
  // the filter parser or smuggle extra predicates; collapse whitespace.
  const clean = escapeLike(raw.replace(/[,().;"']/g, " ").replace(/\s+/g, " ").trim());
  if (!clean) return [];
  const supabase = createClient();

  const filters = [`title.ilike.*${clean}*`, `title_slug.ilike.*${clean}*`];
  // Numeric-only branch: "15" also matches question #15. Non-numeric input
  // must never reach question_id.eq (int column → PG error / 400).
  if (/^\d{1,7}$/.test(raw.trim())) {
    filters.push(`question_id.eq.${raw.trim()}`);
  }

  const { data, error } = await supabase.from("problems").select("*").or(filters.join(",")).limit(safeLimit);

  if (error) {
    throw new DataError("catalog", "Search failed. Retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("catalog", "Search failed. Retry.");
  }
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
// per-topic correctness against a user status map. Paginated: the catalog is
// ~3.4k rows, well past PostgREST's default 1000-row select cap.
export async function getCatalogSlugTopics(): Promise<{ title_slug: string; topics: string[] }[]> {
  const supabase = createClient();
  const rows: { title_slug: string; topics: string[] }[] = [];
  for (let from = 0; from < MAX_CATALOG_ROWS; from += CATALOG_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("problems")
      .select("title_slug, topics")
      .range(from, from + CATALOG_PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as { title_slug: string; topics: string[] }[]));
    if (data.length < CATALOG_PAGE_SIZE) break;
  }

  if (rows.length > 0) {
    return rows;
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
  // A hard failure here is worth surfacing: a wrong "0 problems" count reads as
  // "you have solved everything".
  if (error) {
    throw new DataError("catalog", "Couldn't count the catalog. Retry.", { cause: error });
  }

  // Catalog genuinely empty (sync hasn't run): fall back to curated sheets.
  const unique = new Set(CURATED_SHEETS.flatMap((s) => s.problems.map((p) => p.title_slug)));
  return unique.size;
}

/** Problems tagged with a topic (pattern hub starters + approach scoping). */
export async function getCatalogByTopic(topic: string, limit = 50): Promise<Problem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .contains("topics", [topic])
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) {
    throw new DataError("catalog", "Couldn't load that pattern's problems. Retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("catalog", "Couldn't load that pattern's problems. Retry.");
  }
  return data as Problem[];
}
