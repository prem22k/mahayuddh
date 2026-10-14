import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";

/**
 * Loop C reads (Step 26, Bible §47, §56).
 *
 * The counters are maintained by a Postgres trigger, so these reads cannot
 * drift from the copies that actually exist. The rollups are views and
 * functions for the same reason: an author-facing number that has to be
 * recomputed in application code is a number that will eventually be wrong.
 */

export interface ImpactRow {
  source_type: "approach" | "primer" | "resource";
  source_id: string;
  label: string;
  slug?: string | null;
  forks: number;
  completions: number;
  /** A sentence written to be read, and false when the answer is "not yet". */
  headline: string;
}

/**
 * What your writing has done, per object.
 *
 * The SQL already omits anything nobody has copied, so there are no zero rows
 * to filter here.
 */
export async function getMyContentImpact(): Promise<ImpactRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_content_impact");
  if (error) throw new DataError("impact", "Couldn't load your impact. Retry.", { cause: error });

  const rows = (data ?? []) as Omit<ImpactRow, "slug">[];

  // The rollup returns a label but not a link target, so the slugs are filled
  // in here. Only for primers, which is the only kind addressed by slug.
  const primerIds = rows.filter((r) => r.source_type === "primer").map((r) => r.source_id);
  const slugs = new Map<string, string>();
  if (primerIds.length > 0) {
    const { data: primers } = await supabase
      .from("primers")
      .select("id,slug")
      .in("id", primerIds);
    for (const p of (primers ?? []) as { id: string; slug: string }[]) slugs.set(p.id, p.slug);
  }

  return rows.map((r) => ({
    ...r,
    slug: r.source_type === "primer" ? slugs.get(r.source_id) ?? null : null,
  }));
}

export interface ForkLink {
  fork_id: string;
  forker_id: string;
  forker_username: string;
  source_label: string;
  solved_at: string | null;
  solved_relative: string | null;
}

/**
 * Who copied what, and whether they went on to solve it.
 *
 * The chain UI in §26's terms: "Prem → Rahul → Arjun". Reads `content_impact`,
 * which is a view over the copies, so a deleted copy disappears from here too.
 */
export async function getForkChain(limit = 20): Promise<ForkLink[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("content_impact")
    .select("fork_id,forker_id,forker_username,source_id,source_type,problem_slug,forked_at,solved_at")
    .order("forked_at", { ascending: false })
    .limit(200);
  if (error) throw new DataError("impact", "Couldn't load the fork chain. Retry.", { cause: error });

  const rows = (data ?? []) as {
    fork_id: string;
    forker_id: string;
    forker_username: string;
    source_id: string;
    source_type: string;
    problem_slug: string;
    solved_at: string | null;
  }[];

  const mine = rows.filter((r) => r.forker_id !== user.id);
  if (mine.length === 0) return [];

  // Labels for the sources, fetched once for whatever types are present.
  const primerIds = mine.filter((r) => r.source_type === "primer").map((r) => r.source_id);
  const approachIds = mine.filter((r) => r.source_type === "approach").map((r) => r.source_id);
  const labels = new Map<string, string>();

  if (primerIds.length > 0) {
    const { data } = await supabase.from("primers").select("id,title").in("id", primerIds);
    for (const p of (data ?? []) as { id: string; title: string }[]) labels.set(p.id, p.title);
  }
  if (approachIds.length > 0) {
    const { data } = await supabase
      .from("approaches")
      .select("id,problem_slug")
      .in("id", approachIds);
    for (const a of (data ?? []) as { id: string; problem_slug: string }[]) {
      labels.set(a.id, `${a.problem_slug.replace(/-/g, " ")} approach`);
    }
  }

  return mine.slice(0, limit).map((r) => ({
    fork_id: r.fork_id,
    forker_id: r.forker_id,
    forker_username: r.forker_username,
    source_label: labels.get(r.source_id) ?? r.problem_slug.replace(/-/g, " "),
    solved_at: r.solved_at,
    solved_relative: r.solved_at ? relative(r.solved_at) : null,
  }));
}

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "the same day";
  if (days === 1) return "the next day";
  if (days < 30) return `${days} days later`;
  return `${Math.round(days / 30)} months later`;
}

/**
 * Total completions across everything you have written.
 *
 * A single number is used here and nowhere else. §22 bans compressing
 * reputation into one score; this is not reputation, it is "how many people
 * solved something after reading you", and it has no competitors on a
 * leaderboard.
 */
export async function getTotalCompletions(): Promise<number> {
  const rows = await getMyContentImpact().catch(() => [] as ImpactRow[]);
  return rows.reduce((n, r) => n + r.completions, 0);
}