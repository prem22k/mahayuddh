import { getServiceClient } from "@/lib/supabase/service";
import type { SquadRecap } from "@/types/database";

/**
 * Server read of one frozen recap, for the public share surface.
 *
 * Reads only the stored projection, never the underlying rows: whatever the
 * squad saw in that week is exactly what a visitor sees, and nothing that was
 * later deleted can leak in through a re-derivation.
 *
 * Returns null when the recap or the squad is gone, so the route can 404
 * rather than render a shell around nothing.
 */
export async function getPublicRecap(
  squadId: string,
  recapId: string
): Promise<{ recap: SquadRecap; squadName: string } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("squad_recaps")
    .select("id,squad_id,week_start,week_end,body_json,generated_by,created_at")
    .eq("id", recapId)
    .eq("squad_id", squadId)
    .maybeSingle();
  if (error || !data) return null;

  const recap = data as SquadRecap;

  const { data: squad } = await supabase
    .from("squads")
    .select("name")
    .eq("id", squadId)
    .maybeSingle();

  return { recap, squadName: (squad as { name: string } | null)?.name ?? "A squad" };
}
