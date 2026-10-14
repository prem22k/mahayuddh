import { createClient } from "@/lib/supabase/client";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { slugifyTitle } from "@/lib/slug";
import { CustomList, ListProblem, UserProblemStatus, TriState, Problem } from "@/types/database";
import { CURATED_SHEETS } from "@/lib/data/curatedSheetsData";
import { DataError } from "@/lib/data/errors";

/** Explicit projections (no `*`): every column of each table, per schema. */
const CUSTOM_LIST_COLUMNS = "id,slug,title,emoji,description,is_curated,created_by,created_at";
// list_problems has no created_at column in the schema.
const LIST_PROBLEM_COLUMNS = "id,list_id,title,title_slug,difficulty,category,order_index";
const STATUS_COLUMNS = "id,user_id,problem_slug,status,notes,solved_at";

export async function getAllLists(): Promise<CustomList[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("custom_lists")
    .select(CUSTOM_LIST_COLUMNS)
    .order("is_curated", { ascending: false });

  if (!error && data && data.length > 0) {
    const existingSlugs = new Set(data.map((l) => l.slug));
    const missingCurated: CustomList[] = CURATED_SHEETS.filter((s) => !existingSlugs.has(s.slug)).map((s) => ({
      id: `curated-${s.slug}`,
      slug: s.slug,
      title: s.title,
      emoji: s.emoji,
      description: s.description,
      is_curated: true,
      created_by: null,
      created_at: new Date().toISOString(),
    }));
    return [...data, ...missingCurated] as CustomList[];
  }

  return CURATED_SHEETS.map((s) => ({
    id: `curated-${s.slug}`,
    slug: s.slug,
    title: s.title,
    emoji: s.emoji,
    description: s.description,
    is_curated: true,
    created_by: null,
    created_at: new Date().toISOString(),
  }));
}

export async function getAllProblems(): Promise<ListProblem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("list_problems")
    .select(LIST_PROBLEM_COLUMNS)
    .order("order_index", { ascending: true });

  if (!error && data && data.length > 0) {
    return data as ListProblem[];
  }

  // Fallback to all curated problems
  return CURATED_SHEETS.flatMap((s) =>
    s.problems.map((p, idx) => ({
      id: `curated-${s.slug}-${p.title_slug}-${idx}`,
      list_id: `curated-${s.slug}`,
      title: p.title,
      title_slug: p.title_slug,
      difficulty: p.difficulty,
      category: p.category,
      order_index: p.order_index,
      created_at: new Date().toISOString(),
    }))
  );
}

export async function getListWithProblems(slug: string): Promise<{
  list: CustomList | null;
  problems: ListProblem[];
}> {
  const supabase = createClient();
  const curated = CURATED_SHEETS.find((s) => s.slug === slug);

  const { data: listData } = await supabase
    .from("custom_lists")
    .select(CUSTOM_LIST_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  let targetList: CustomList | null = (listData as CustomList) || null;
  if (!targetList && curated) {
    targetList = {
      id: `curated-${curated.slug}`,
      slug: curated.slug,
      title: curated.title,
      emoji: curated.emoji,
      description: curated.description,
      is_curated: true,
      created_by: null,
      created_at: new Date().toISOString(),
    };
  }

  if (!targetList) {
    return { list: null, problems: [] };
  }

  let problems: ListProblem[] = [];
  if (listData?.id) {
    const { data: problemsData } = await supabase
      .from("list_problems")
      .select(LIST_PROBLEM_COLUMNS)
      .eq("list_id", listData.id)
      .order("order_index", { ascending: true });

    if (problemsData && problemsData.length > 0) {
      problems = problemsData as ListProblem[];
    }
  }

  // If database has fewer problems than the curated complete set, use complete curated set
  if (curated && problems.length < curated.problems.length) {
    problems = curated.problems.map((p, idx) => ({
      id: `curated-${slug}-${p.title_slug}-${idx}`,
      list_id: targetList?.id || `curated-${slug}`,
      title: p.title,
      title_slug: p.title_slug,
      difficulty: p.difficulty,
      category: p.category,
      order_index: p.order_index,
      created_at: new Date().toISOString(),
    }));
  }

  return {
    list: targetList,
    problems,
  };
}

export async function createCustomList(
  userId: string,
  title: string,
  description: string,
  problemSlugs: string[]
): Promise<{ success: boolean; slug?: string; error?: string }> {
  const supabase = createClient();
  // Cap the base at 75 chars: the 4-char suffix must fit the 80-char slug check.
  const baseSlug = slugifyTitle(title, 75);
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
    .maybeSingle();

  if (listError || !listData) {
    return { success: false, error: listError?.message || "Failed to create list" };
  }

  if (problemSlugs.length > 0) {
    const uniqueSlugs = Array.from(new Set(problemSlugs));
    const resolvedMap = new Map<string, { title: string; title_slug: string; difficulty: string; category: string }>();

    // 1. Try resolving from list_problems
    const { data: existingListProblems } = await supabase
      .from("list_problems")
      .select("title, title_slug, difficulty, category")
      .in("title_slug", uniqueSlugs);

    (existingListProblems || []).forEach((p) => {
      resolvedMap.set(p.title_slug, p);
    });

    // 2. Resolve missing from problems catalog
    const missingSlugs = uniqueSlugs.filter((s) => !resolvedMap.has(s));
    if (missingSlugs.length > 0) {
      const { data: catalogProblems } = await supabase
        .from("problems")
        .select("title, title_slug, difficulty, topics")
        .in("title_slug", missingSlugs);

      (catalogProblems || []).forEach((c) => {
        resolvedMap.set(c.title_slug, {
          title: c.title,
          title_slug: c.title_slug,
          difficulty: c.difficulty,
          category: c.topics?.[0] || "General",
        });
      });
    }

    // 3. Resolve any remaining from static curated sheets
    for (const slug of uniqueSlugs) {
      if (!resolvedMap.has(slug)) {
        for (const sheet of CURATED_SHEETS) {
          const found = sheet.problems.find((p) => p.title_slug === slug);
          if (found) {
            resolvedMap.set(slug, {
              title: found.title,
              title_slug: found.title_slug,
              difficulty: found.difficulty,
              category: found.category,
            });
            break;
          }
        }
      }
    }

    const problemsToInsert = Array.from(resolvedMap.values()).map((p, idx) => ({
      list_id: listData.id,
      title: p.title,
      title_slug: p.title_slug,
      difficulty: p.difficulty,
      category: p.category,
      order_index: idx + 1,
    }));

    if (problemsToInsert.length > 0) {
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
      .select(STATUS_COLUMNS)
      .in("problem_slug", slice);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    // Silent `continue` here would under-report progress without any signal.
    if (error) {
      throw new DataError("sheets", "Couldn't load your problem statuses. Retry.", { cause: error });
    }
    if (!data) {
      throw new DataError("sheets", "Couldn't load your problem statuses. Retry.");
    }
    rows.push(...(data as UserProblemStatus[]));
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

  // This feeds the Arena progress strip. Returning [] on failure rendered a
  // confident "0 solved" — the most misleading failure mode in the app.
  if (error) {
    throw new DataError("sheets", "Couldn't load your progress. Retry.", { cause: error });
  }
  if (!data) {
    throw new DataError("sheets", "Couldn't load your progress. Retry.");
  }
  return data as UserProblemStatus[];
}

// StatusMap / toStatusMap moved to lib/statusMap.ts: pure, dependency-free, and
// therefore importable from node:test. Re-exported here so existing call sites
// keep working.
export type { StatusMap } from "@/lib/statusMap";
export { toStatusMap } from "@/lib/statusMap";

// Internal use below: the re-exports above are for existing call sites.
import { toStatusMap as buildStatusMap } from "@/lib/statusMap";
import type { StatusMap as StatusMapType } from "@/lib/statusMap";

// Tri-state setter: "solved" | "attempted" | "unsolved" (deletes the row).
// Returns false when the write fails so optimistic UI can roll back.
export async function setProblemStatus(
  userId: string,
  slug: string,
  next: TriState
): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } =
      next === "unsolved"
        ? await supabase
            .from("user_problem_status")
            .delete()
            .eq("user_id", userId)
            .eq("problem_slug", slug)
        : await supabase.from("user_problem_status").upsert(
            {
              user_id: userId,
              problem_slug: slug,
              status: next,
              solved_at: new Date().toISOString(),
            },
            { onConflict: "user_id,problem_slug" }
          );
    return !error;
  } catch {
    return false;
  }
}

export async function toggleProblemStatus(userId: string, problemSlug: string, isSolved: boolean) {
  return setProblemStatus(userId, problemSlug, isSolved ? "solved" : "unsolved");
}

export async function batchSetProblemStatuses(
  userId: string,
  slugs: string[],
  next: TriState
): Promise<boolean> {
  const supabase = createClient();
  if (slugs.length === 0) return true;

  if (next === "unsolved") {
    const { error } = await supabase
      .from("user_problem_status")
      .delete()
      .eq("user_id", userId)
      .in("problem_slug", slugs);
    return !error;
  }

  const rows = slugs.map((slug) => ({
    user_id: userId,
    problem_slug: slug,
    status: next,
    solved_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("user_problem_status")
    .upsert(rows, { onConflict: "user_id,problem_slug" });

  return !error;
}

// Joins a curated sheet's problems with the catalog + the user's status map.
export async function getSheetWithCatalog(
  slug: string,
  userId?: string
): Promise<{
  list: CustomList | null;
  problems: ListProblem[];
  catalogBySlug: Map<string, Problem>;
  statusMap: StatusMapType;
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
    statusMap: buildStatusMap(statuses),
  };
}
