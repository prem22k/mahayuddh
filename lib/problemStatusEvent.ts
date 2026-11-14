import type { TriState } from "@/types/database";

const VALID_STATUSES = new Set(["solved", "attempted", "unsolved"]);

/**
 * Validate a "problem-status-changed" CustomEvent payload.
 * Null when the shape is junk — callers must ignore, never merge blindly.
 */
export function parseProblemStatusEvent(
  e: Event
): { slug: string; status: TriState } | null {
  const detail = (e as CustomEvent<{ slug?: unknown; status?: unknown }>).detail;
  const slug = typeof detail?.slug === "string" ? detail.slug.toLowerCase() : "";
  const status = typeof detail?.status === "string" ? detail.status : "";
  if (!slug || !VALID_STATUSES.has(status)) return null;
  return { slug, status: status as TriState };
}

/** Merge a status change into a map; "unsolved" deletes the key. */
export function applyStatusChange(
  prev: Record<string, TriState>,
  slug: string,
  status: TriState
): Record<string, TriState> {
  const next = { ...prev };
  if (status === "unsolved") delete next[slug];
  else next[slug] = status;
  return next;
}

/**
 * True when the history holds a solve that LeetCode vouched for. A hand-marked
 * solve logs `metadata.source = 'self'`; the server's evidence-label guard
 * downgrades any client claim of 'leetcode' it cannot match to a verified
 * battle, so this reads as real evidence even without a battle row.
 */
export function hasLeetcodeSolve(
  events: ReadonlyArray<{ kind: string; metadata?: Record<string, unknown> | null }>
): boolean {
  return events.some((ev) => ev.kind === "solved" && ev.metadata?.source === "leetcode");
}
