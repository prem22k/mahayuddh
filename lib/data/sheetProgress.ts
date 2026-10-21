import { getListWithProblems, getUserStatusesBySlugs } from "@/lib/data/sheets";

/** The three pinned sheets the shell and the Practice hub show. */
export const PINNED_SHEETS = [
  { slug: "neetcode-150", title: "NeetCode 150" },
  { slug: "blind-75", title: "Blind 75" },
  { slug: "striver-sde", title: "Striver SDE" },
] as const;

export type SheetProgress = { total: number; solved: number };

// The sidebar mounts on every page; without a cache each navigation would
// refetch three sheets plus the user's statuses. Progress only moves when the
// user solves something, so a few minutes of staleness is fine for a hint.
const TTL_MS = 5 * 60_000;
let cache: { userId: string; at: number; value: Record<string, SheetProgress | null> } | null = null;
let inflight: Promise<Record<string, SheetProgress | null>> | null = null;

/**
 * Measured progress for the pinned sheets: list size plus the user's own
 * solved marks. A sheet whose fetch fails maps to null so callers render it
 * without a number rather than a made-up one.
 */
export async function getPinnedSheetProgress(
  userId: string
): Promise<Record<string, SheetProgress | null>> {
  if (cache && cache.userId === userId && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inflight) return inflight;
  inflight = (async () => {
    const statuses = await getUserStatusesBySlugs(userId).catch(() => null);
    const solved = new Set(
      (statuses ?? []).filter((s) => s.status === "solved").map((s) => s.problem_slug)
    );
    const out: Record<string, SheetProgress | null> = {};
    await Promise.all(
      PINNED_SHEETS.map(async (s) => {
        if (!statuses) {
          out[s.slug] = null;
          return;
        }
        try {
          const { problems } = await getListWithProblems(s.slug);
          out[s.slug] = {
            total: problems.length,
            solved: problems.filter((p) => solved.has(p.title_slug)).length,
          };
        } catch {
          out[s.slug] = null;
        }
      })
    );
    cache = { userId, at: Date.now(), value: out };
    return out;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
