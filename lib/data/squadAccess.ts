import { getServiceClient, resolveUser } from "@/lib/supabase/service";

/**
 * Whether the person viewing a server-rendered squad page may see the squad.
 *
 * The recap and season share pages read with the service role, which skips
 * every policy, so they check here what can_see_squad() checks for browsers: a
 * public squad, or a squad the signed-in viewer belongs to. Share images are
 * fetched by crawlers with no session, so a private squad's image is never
 * rendered.
 */
export async function viewerCanSeeSquad(squadId: string): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return false;
  const { data: squad } = await supabase.from("squads").select("visibility").eq("id", squadId).maybeSingle();
  if (!squad) return false;
  if ((squad as { visibility: string }).visibility === "public") return true;
  const viewer = await resolveUser(null);
  if (!viewer) return false;
  const { data: member } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squadId)
    .eq("user_id", viewer.id)
    .maybeSingle();
  return !!member;
}
