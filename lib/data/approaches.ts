import { createClient } from "@/lib/supabase/client";
import { Approach, ApproachVisibility } from "@/types/database";
import { DataError } from "@/lib/data/errors";

/** Approaches visible to the caller for one problem (RLS enforces privacy). */
export async function getApproachesForProblem(problemSlug: string): Promise<Approach[]> {
  return getApproachesForSlugs([problemSlug], 20);
}

/** Approaches across several slugs (pattern hubs). RLS enforces privacy. */
export async function getApproachesForSlugs(slugs: string[], limit = 20): Promise<Approach[]> {
  const unique = Array.from(new Set(slugs.map((s) => s.toLowerCase()))).slice(0, 100);
  if (unique.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("approaches")
    .select("*, author:user_id (id, username, avatar_url)")
    .in("problem_slug", unique)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new DataError("approaches", "Couldn't load approaches. Retry.", { cause: error });
  if (!data) throw new DataError("approaches", "Couldn't load approaches. Retry.");
  return data as Approach[];
}

export async function getApproachById(id: string): Promise<Approach | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("approaches")
    .select("*, author:user_id (id, username, avatar_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new DataError("approaches", "Couldn't load this approach. Retry.", { cause: error });
  return (data as Approach | null) ?? null;
}

export async function createApproach(params: {
  problemSlug: string;
  coreIdea: string;
  pattern?: string;
  complexityTime?: string;
  complexitySpace?: string;
  keyDetail?: string;
  edgeCases?: string;
  mistakes?: string;
  code?: string;
  visibility?: ApproachVisibility;
  squadId?: string | null;
}): Promise<Approach> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new DataError("approaches", "Log in to save your approach.");
  const coreIdea = params.coreIdea.trim().slice(0, 5000);
  if (!coreIdea) throw new DataError("approaches", "Core idea is required.");
  const { data, error } = await supabase
    .from("approaches")
    .insert({
      user_id: user.id,
      problem_slug: params.problemSlug.toLowerCase(),
      core_idea: coreIdea,
      pattern: params.pattern?.trim() || null,
      complexity_time: params.complexityTime?.trim() || null,
      complexity_space: params.complexitySpace?.trim() || null,
      key_detail: params.keyDetail?.trim() || null,
      edge_cases: params.edgeCases?.trim() || null,
      mistakes: params.mistakes?.trim() || null,
      code: params.code?.trim()?.slice(0, 20000) || null,
      visibility: params.visibility ?? "private",
      squad_id: params.visibility === "squad" ? (params.squadId ?? null) : null,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new DataError("approaches", "Couldn't save approach. Try again.", { cause: error });
  }
  return data as Approach;
}

export async function setApproachVisibility(id: string, visibility: ApproachVisibility, squadId?: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("approaches")
    .update({ visibility, squad_id: visibility === "squad" ? (squadId ?? null) : null })
    .eq("id", id);
  if (error) throw new DataError("approaches", "Couldn't change sharing. Try again.", { cause: error });
}

export async function deleteApproach(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("approaches").delete().eq("id", id);
  if (error) throw new DataError("approaches", "Couldn't delete approach. Try again.", { cause: error });
}
