import { createClient } from "@/lib/supabase/client";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { CustomList, ListProblem, UserProblemStatus, TriState, Problem } from "@/types/database";

export async function getAllLists(): Promise<CustomList[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("custom_lists")
    .select("*")
    .order("is_curated", { ascending: false });

  if (error || !data) return [];
  return data as CustomList[];
}

export async function getAllProblems(): Promise<ListProblem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("list_problems")
    .select("*")
    .order("order_index", { ascending: true });

  if (error || !data) return [];
  return data as ListProblem[];
}

export async function getListWithProblems(slug: string): Promise<{
  list: CustomList | null;
  problems: ListProblem[];
}> {
  const supabase = createClient();

  const { data: listData, error: listError } = await supabase
    .from("custom_lists")
    .select("*")
    .eq("slug", slug)
    .single();

  if (listError || !listData) {
    return { list: null, problems: [] };
  }

  const { data: problemsData, error: problemsError } = await supabase
    .from("list_problems")
    .select("*")
    .eq("list_id", listData.id)
    .order("order_index", { ascending: true });

  if (problemsError || !problemsData) {
    return { list: listData as CustomList, problems: [] };
  }

  return {
    list: listData as CustomList,
    problems: problemsData as ListProblem[],
  };
}

export async function createCustomList(
  userId: string,
  title: string,
  description: string,
  problemSlugs: string[]
): Promise<{ success: boolean; slug?: string; error?: string }> {
  const supabase = createClient();
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const slug = `${baseSlug || "custom-list"}-${Math.random().toString(36).substring(2, 6)}`;

  const { data: listData, error: listError } = await supabase
    .from("custom_lists")
    .insert({
      slug,
      title: title.trim(),
      description: description.trim() || null,
      is_curated: false,
      created_by: userId,
    })
    .select()
    .single();

  if (listError || !listData) {
    return { success: false, error: listError?.message || "Failed to create list" };
  }

  if (problemSlugs.length > 0) {
    const { data: existingProblems } = await supabase
      .from("list_problems")
      .select("title, title_slug, difficulty, category")
      .in("title_slug", problemSlugs);

    if (existingProblems && existingProblems.length > 0) {
      const uniqueProblemsMap = new Map<string, typeof existingProblems[0]>();
      existingProblems.forEach((p) => {
        if (!uniqueProblemsMap.has(p.title_slug)) {
          uniqueProblemsMap.set(p.title_slug, p);
        }
      });

      const problemsToInsert = Array.from(uniqueProblemsMap.values()).map((p, idx) => ({
        list_id: listData.id,
        title: p.title,
        title_slug: p.title_slug,
        difficulty: p.difficulty,
        category: p.category,
        order_index: idx + 1,
      }));

      await supabase.from("list_problems").insert(problemsToInsert);
    }
  }

  return { success: true, slug };
}

export async function getSquadProblemStatuses(
  problemSlugs: string[],
  userId?: string
): Promise<UserProblemStatus[]> {
  if (problemSlugs.length === 0) return [];
  const supabase = createClient();

  const rows: UserProblemStatus[] = [];
  const CHUNK = 200;
  for (let i = 0; i < problemSlugs.length; i += CHUNK) {
    const slice = problemSlugs.slice(i, i + CHUNK);
    let query = supabase
      .from("user_problem_status")
      .select("*")
      .in("problem_slug", slice);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) continue;
    if (data) rows.push(...(data as UserProblemStatus[]));
  }
  return rows;
}

// Fetch all of a user's statuses at once (used by Arena instead of passing ~3500 slugs).
export async function getUserStatusesBySlugs(userId: string): Promise<UserProblemStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_problem_status")
    .select("problem_slug, status, solved_at, notes")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data as UserProblemStatus[];
}

export type StatusMap = Record<string, TriState>;

export function toStatusMap(
  rows: { problem_slug: string; status: "solved" | "attempted" }[]
): StatusMap {
  const map: StatusMap = {};
  for (const r of rows) map[r.problem_slug] = r.status;
  return map;
}

// Tri-state setter: "solved" | "attempted" | "unsolved" (deletes the row).
export async function setProblemStatus(userId: string, slug: string, next: TriState) {
  const supabase = createClient();

  if (next === "unsolved") {
    await supabase
      .from("user_problem_status")
      .delete()
      .eq("user_id", userId)
      .eq("problem_slug", slug);
    return;
  }

  await supabase
    .from("user_problem_status")
    .upsert(
      {
        user_id: userId,
        problem_slug: slug,
        status: next,
        solved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,problem_slug" }
    );
}

export async function toggleProblemStatus(userId: string, problemSlug: string, isSolved: boolean) {
  return setProblemStatus(userId, problemSlug, isSolved ? "solved" : "unsolved");
}

// Joins a curated sheet's problems with the catalog + the user's status map.
export async function getSheetWithCatalog(
  slug: string,
  userId?: string
): Promise<{
  list: CustomList | null;
  problems: ListProblem[];
  catalogBySlug: Map<string, Problem>;
  statusMap: StatusMap;
}> {
  const { list, problems } = await getListWithProblems(slug);
  const slugs = problems.map((p) => p.title_slug);

  const [catalog, statuses] = await Promise.all([
    getCatalogBySlugs(slugs),
    userId ? getUserStatusesBySlugs(userId) : Promise.resolve([] as UserProblemStatus[]),
  ]);

  return {
    list,
    problems,
    catalogBySlug: new Map(catalog.map((c) => [c.title_slug, c])),
    statusMap: toStatusMap(statuses),
  };
}
