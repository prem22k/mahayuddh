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

export function countByStatus(map: StatusMap): { solved: number; attempted: number } {
  let solved = 0;
  let attempted = 0;
  for (const v of Object.values(map)) {
    if (v === "solved") solved++;
    else if (v === "attempted") attempted++;
  }
  return { solved, attempted };
}