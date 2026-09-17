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
