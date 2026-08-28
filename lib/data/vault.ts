import { createClient } from "@/lib/supabase/client";
import { SharedResource, ResourceCategory } from "@/types/database";

export async function getSharedResources(category?: ResourceCategory): Promise<SharedResource[]> {
  const supabase = createClient();
  let query = supabase
    .from("shared_resources")
    .select(`
      *,
      author_profile:author_id (id, username, leetcode_username, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as SharedResource[];
}

export async function createSharedResource(params: {
  title: string;
  category: ResourceCategory;
  content: string;
  authorId?: string;
  externalUrl?: string;
}): Promise<SharedResource | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shared_resources")
    .insert({
      title: params.title,
      category: params.category,
      content: params.content,
      author_id: params.authorId || null,
      external_url: params.externalUrl || null,
    })
    .select(`
      *,
      author_profile:author_id (id, username, leetcode_username, avatar_url)
    `)
    .maybeSingle();

  if (error || !data) return null;
  return data as SharedResource;
}

export async function deleteSharedResource(id: string, authorId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shared_resources")
    .delete()
    .eq("id", id)
    .eq("author_id", authorId);

  return !error;
}
