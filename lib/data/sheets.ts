import { createClient } from "@/lib/supabase/client";
import { CustomList, ListProblem, UserProblemStatus } from "@/types/database";

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

export async function getSquadProblemStatuses(problemSlugs: string[]): Promise<UserProblemStatus[]> {
  if (problemSlugs.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("user_problem_status")
    .select("*")
    .in("problem_slug", problemSlugs);

  if (error || !data) return [];
  return data as UserProblemStatus[];
}

export async function toggleProblemStatus(userId: string, problemSlug: string, isSolved: boolean) {
  const supabase = createClient();

  if (isSolved) {
    await supabase
      .from("user_problem_status")
      .upsert({
        user_id: userId,
        problem_slug: problemSlug,
        status: "solved",
        solved_at: new Date().toISOString(),
      }, { onConflict: "user_id,problem_slug" });
  } else {
    await supabase
      .from("user_problem_status")
      .delete()
      .eq("user_id", userId)
      .eq("problem_slug", problemSlug);
  }
}
