import { getListWithProblems, getUserStatusesBySlugs } from "@/lib/data/sheets";

/** The three pinned sheets the shell and the Practice hub show. */
export const PINNED_SHEETS = [
  { slug: "neetcode-150", title: "NeetCode 150" },
  { slug: "blind-75", title: "Blind 75" },
  { slug: "striver-sde", title: "Striver SDE" },
] as const;

export type SheetProgress = { total: number; solved: number };

// Caching belongs to the client cache (lib/cache), which keys this per user
// as "pinned-sheet-progress", keeps it fresh for five minutes across
// navigations, and can be invalidated after a solve or a LeetCode sync. This
// module used to keep its own five-minute copy too, which no invalidation
// could reach: the sidebar kept old percentages after a sync or a solve. Only
// concurrent calls are shared now.
let inflight: { userId: string; promise: Promise<Record<string, SheetProgress | null>> } | null = null;

/**
 * Measured progress for the pinned sheets: list size plus the user's own
 * solved marks. A sheet whose fetch fails maps to null so callers render it
 * without a number rather than a made-up one.
 */
export async function getPinnedSheetProgress(
  userId: string
): Promise<Record<string, SheetProgress | null>> {
  if (inflight && inflight.userId === userId) return inflight.promise;
  const promise = (async () => {
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
    return out;
  })().finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { userId, promise };
  return promise;
}
