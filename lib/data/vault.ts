import { createClient } from "@/lib/supabase/client";
import { SharedResource, ResourceCategory, ResourceVisibility } from "@/types/database";
import { DataError } from "@/lib/data/errors";

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
  if (error) {
    throw new DataError("vault", "Couldn't load vault resources. Check your connection and retry.", { cause: error });
  }
  // A null payload with no error is still a broken read: surface it rather than
  // rendering "the vault is empty" (Step 0 hazard 4).
  if (!data) {
    throw new DataError("vault", "Couldn't load vault resources. Check your connection and retry.");
  }
  return data as SharedResource[];
}

export async function createSharedResource(params: {
  title: string;
  category: ResourceCategory;
  content: string;
  authorId?: string;
  externalUrl?: string;
  visibility?: ResourceVisibility;
  squadId?: string | null;
}): Promise<SharedResource> {
  const supabase = createClient();
  const visibility = params.visibility ?? "public";
  const { data, error } = await supabase
    .from("shared_resources")
    .insert({
      title: params.title,
      category: params.category,
      content: params.content,
      author_id: params.authorId || null,
      external_url: params.externalUrl || null,
      visibility,
      squad_id: visibility === "squad" ? (params.squadId ?? null) : null,
    })
    .select(`
      *,
      author_profile:author_id (id, username, leetcode_username, avatar_url)
    `)
    .maybeSingle();

  if (error) {
    throw new DataError("vault", "Couldn't publish to the vault. Try again.", { cause: error });
  }
  if (!data) {
    throw new DataError("vault", "Couldn't publish to the vault. Try again.");
  }
  return data as SharedResource;
}

export async function deleteSharedResource(id: string, authorId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shared_resources")
    .delete()
    .eq("id", id)
    .eq("author_id", authorId);

  if (error) {
    throw new DataError("vault", "Couldn't delete that resource. Try again.", { cause: error });
  }
  return true;
}

export async function setResourceVisibility(
  id: string,
  visibility: ResourceVisibility,
  squadId?: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shared_resources")
    .update({ visibility, squad_id: visibility === "squad" ? (squadId ?? null) : null })
    .eq("id", id);
  if (error) {
    throw new DataError("vault", "Couldn't change sharing. Try again.", { cause: error });
  }
}