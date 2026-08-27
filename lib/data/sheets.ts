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
