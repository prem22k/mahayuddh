import { createClient } from "@/lib/supabase/client";
import type { Approach, Battle, Primer, SharedResource } from "@/types/database";

/**
 * Composer reads (Step 21).
 *
 * The plan says the composer's six tiles should each "create correct underlying
 * object + feed event". Five of them were links to wherever the object gets
 * created, which puts the whole job on the reader's memory of the UI. These are
 * the pickers that let a tile do the creating.
 *
 * Each read is scoped to the caller's own rows where the object belongs to
 * them. A picker offering somebody else's battle to share would be a share
 * button for something you cannot claim.
 */

export interface PickableBattle {
  id: string;
  problem_slug: string;
  duration_sec: number | null;
  outcome: string;
  evidence: string;
  started_at: string;
}

/** Battles worth sharing: solved ones only, most recent first. */
export async function getMyShareableBattles(limit = 15): Promise<PickableBattle[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("battles")
    .select("id,problem_slug,duration_sec,outcome,evidence,started_at")
    .eq("user_id", user.id)
    .eq("outcome", "solved")
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PickableBattle[];
}

export interface PickableTeaching {
  id: string;
  kind: "approach" | "primer";
  label: string;
  sublabel: string;
}

/**
 * Public approaches and primers worth teaching.
 *
 * Only `visibility = 'public'` is offered: "Teach" puts the object into other
 * people's feeds, and offering a private note here would publish it without
 * asking.
 */
export async function getMyPublicTeaching(limit = 20): Promise<PickableTeaching[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [approachesRes, primersRes] = await Promise.all([
    supabase
      .from("approaches")
      .select("id,problem_slug,pattern,visibility")
      .eq("user_id", user.id)
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("primers")
      .select("id,slug,pattern,title,visibility")
      .eq("author_id", user.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const approaches = ((approachesRes.data ?? []) as Pick<
    Approach,
    "id" | "problem_slug" | "pattern"
  >[]).map((a) => ({
    id: a.id,
    kind: "approach" as const,
    label: a.problem_slug.replace(/-/g, " "),
    sublabel: a.pattern ?? "approach",
  }));

  const primers = ((primersRes.data ?? []) as Pick<
    Primer,
    "id" | "slug" | "pattern" | "title"
  >[]).map((p) => ({
    id: p.id,
    kind: "primer" as const,
    label: p.title,
    sublabel: p.pattern,
  }));

  return [...approaches, ...primers];
}

export interface PickablePerson {
  id: string;
  username: string;
}

/** Squad-mates you can challenge, excluding yourself. */
export async function getChallengeablePeople(squadId: string | null): Promise<PickablePerson[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !squadId) return [];

  const { data: members } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squadId);
  const ids = ((members ?? []) as { user_id: string }[])
    .map((m) => m.user_id)
    .filter((id) => id !== user.id);
  if (ids.length === 0) return [];

  const { data } = await supabase.from("profiles").select("id,username").in("id", ids);
  return ((data ?? []) as PickablePerson[]).sort((a, b) => a.username.localeCompare(b.username));
}

export async function getMyVaultResources(limit = 20): Promise<PickableTeaching[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("shared_resources")
    .select("id,title,category")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as { id: string; title: string; category: string }[]).map((r) => ({
    id: r.id,
    kind: "primer", // "resource" is how the feed labels it; the picker only needs a kind.
    label: r.title,
    sublabel: r.category,
  }));
}

/** Problems you have solved, for the Ask-help and Challenge pickers. */
export async function getMySolvedProblems(limit = 25): Promise<{ slug: string; title: string }[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_problem_status")
    .select("problem_slug,status")
    .eq("user_id", user.id)
    .eq("status", "solved")
    .limit(limit);
  const slugs = ((data ?? []) as { problem_slug: string }[]).map((r) => r.problem_slug);
  if (slugs.length === 0) return [];

  const { data: catalog } = await supabase
    .from("problems")
    .select("title_slug,title")
    .in("title_slug", slugs);
  return ((catalog ?? []) as { title_slug: string; title: string }[]).map((p) => ({
    slug: p.title_slug,
    title: p.title,
  }));
}

/**
 * Share one solved battle.
 *
 * Creates the feed event only — the battle already exists, and the plan's §64
 * rule is that the feed stores a pointer rather than a copy. The battle card
 * projection picks this up, so sharing a battle is what makes a Battle Card
 * exist.
 */
export async function shareSolvedBattle(battle: PickableBattle): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to share a solve." };

  // Only your own battle, and only a solved one. Re-checked here rather than
  // trusted from the picker, because the id arrives from the client.
  const { data: row } = await supabase
    .from("battles")
    .select("id,user_id,outcome,squad_id,problem_slug")
    .eq("id", battle.id)
    .maybeSingle();
  if (!row || row.user_id !== user.id || row.outcome !== "solved") {
    return { ok: false, error: "That battle isn't a solve of yours." };
  }

  const { error } = await supabase.from("feed_events").insert({
    user_id: user.id,
    event_type: "solve",
    problem_slug: row.problem_slug,
    squad_id: row.squad_id,
    object_type: "battle",
    object_id: row.id,
    metadata: { duration_sec: battle.duration_sec, evidence: battle.evidence, source: "composer" },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Share an approach or primer into the feed. */
export async function shareTeaching(
  item: { id: string; kind: "approach" | "primer"; label: string },
  squadId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to teach." };

  const table = item.kind === "approach" ? "approaches" : "primers";
  const idColumn = item.kind === "approach" ? "id" : "id";
  const { data: row } = await supabase
    .from(table)
    .select("id,visibility")
    .eq(idColumn, item.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "That one is gone." };
  if (row.visibility !== "public") {
    return { ok: false, error: "Make it public first — sharing a private one would publish it." };
  }

  const { error } = await supabase.from("feed_events").insert({
    user_id: user.id,
    event_type: "teach",
    problem_title: item.label,
    squad_id: squadId,
    object_type: item.kind,
    object_id: item.id,
    metadata: { source: "composer" },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Share a vault resource into the feed. */
export async function shareVaultResource(
  item: { id: string; label: string },
  squadId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to share." };

  const { data: row } = await supabase
    .from("shared_resources")
    .select("id,title,visibility")
    .eq("id", item.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "That resource is gone." };

  const { error } = await supabase.from("feed_events").insert({
    user_id: user.id,
    event_type: "resource",
    problem_title: row.title,
    squad_id: squadId,
    object_type: "resource",
    object_id: row.id,
    metadata: { source: "composer" },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Type import kept so the Battle type stays referenced for callers of this module. */
export type ComposerBattleRow = Pick<Battle, "id" | "problem_slug" | "outcome">;
export type ComposerResource = Pick<SharedResource, "id" | "title">;