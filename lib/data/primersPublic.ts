import { getServiceClient } from "@/lib/supabase/service";
import type { Primer } from "@/types/database";

/**
 * Server read of a primer for share surfaces (Step 20, Bible §26).
 *
 * Returns only PUBLIC primers. A squad primer is a member's writing inside a
 * private group, and a crawler fetching an OG image carries no session — so if
 * this function returned squad primers, a share preview would leak a title and
 * a pattern that the squad chose not to publish.
 */
export async function getPublicPrimer(slug: string): Promise<Primer | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("primers")
    .select(
      "id, slug, pattern, title, recognize_when, mental_model, template_md, complexity, mistakes, starter_slugs, author_id, visibility, squad_id, created_at"
    )
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle();

  return (data as Primer | null) ?? null;
}
