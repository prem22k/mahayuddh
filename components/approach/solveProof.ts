/**
 * The author's own solve of the problem an approach is about, from their
 * append-only problem_events history. Verified only when the event carries
 * LeetCode-sync metadata (source='leetcode', the same rule the leaderboard
 * uses); otherwise it is a self-reported solve. Null when there is no solve.
 */
export type SolveProof = { seconds: number | null; verified: boolean };

export function pickSolveProof(
  events: Array<{ kind: string; duration_sec: number | null; metadata: Record<string, unknown> | null }>
): SolveProof | null {
  const solves = events.filter((e) => e.kind === "solved");
  if (solves.length === 0) return null;
  const verified = solves.filter((e) => e.metadata?.source === "leetcode");
  const pool = verified.length > 0 ? verified : solves;
  const timed = pool
    .map((e) => e.duration_sec)
    .filter((d): d is number => d != null && Number.isFinite(d) && d > 0);
  return { seconds: timed.length > 0 ? Math.min(...timed) : null, verified: verified.length > 0 };
}
