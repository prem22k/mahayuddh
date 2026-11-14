import type { TriState } from "@/types/database";

/**
 * Pure status-map helpers.
 *
 * Deliberately dependency-free (no Supabase client) so the smoke tests can
 * import the REAL implementation. They previously lived in lib/data/sheets.ts,
 * which pulls in the browser client and made them untestable outside Next.
 */
export type StatusMap = Record<string, TriState>;

/** Build the map from user_problem_status rows. Last write wins. */
export function toStatusMap(
  rows: { problem_slug: string; status: "solved" | "attempted" }[]
): StatusMap {
  const map: StatusMap = {};
  for (const r of rows) map[r.problem_slug] = r.status;
  return map;
}

/** Merge a status change into a map; "unsolved" deletes the key (tri-state). */
export function applyStatusChange(
  prev: StatusMap,
  slug: string,
  status: TriState
): StatusMap {
  const next = { ...prev };
  if (status === "unsolved") delete next[slug];
  else next[slug] = status;
  return next;
}

/** A category chip selects exactly that category: "Graphs" must not also pull in "Advanced Graphs". */
export function matchesCategory(problemCategory: string, selected: string): boolean {
  return selected === "All" || problemCategory === selected;
}

export interface CategoryProgress {
  total: number;
  solved: number;
  verified: number;
}

/**
 * Per-category progress over the WHOLE sheet. Callers show this beside a
 * category even while a status/search filter hides rows, so a "Solved" filter
 * reads 3/12 rather than a meaningless 3/3.
 */
export function categoryProgress(
  problems: ReadonlyArray<{ category: string; title_slug: string }>,
  statuses: StatusMap,
  isVerified: (slug: string) => boolean
): Map<string, CategoryProgress> {
  const out = new Map<string, CategoryProgress>();
  for (const p of problems) {
    const row = out.get(p.category) ?? { total: 0, solved: 0, verified: 0 };
    row.total++;
    if (statuses[p.title_slug] === "solved") {
      row.solved++;
      if (isVerified(p.title_slug)) row.verified++;
    }
    out.set(p.category, row);
  }
  return out;
}

export function countByStatus(map: StatusMap): { solved: number; attempted: number } {
  let solved = 0;
  let attempted = 0;
  for (const v of Object.values(map)) {
    if (v === "solved") solved++;
    else if (v === "attempted") attempted++;
  }
  return { solved, attempted };
}