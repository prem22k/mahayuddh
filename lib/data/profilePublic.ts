import { getServiceClient } from "@/lib/supabase/service";
import type { TeacherStats } from "@/lib/reputation";
import type { Approach, Primer } from "@/types/database";

/**
 * SERVER-ONLY. Reads for /u/[username].
 *
 * Split out of lib/data/profile.ts because that module is client-safe (the
 * FollowButton imports it) and the service client pulls next/headers into the
 * browser bundle.
 */

const APPROACH_COLUMNS =
  "id,user_id,problem_slug,pattern,core_idea,complexity_time,complexity_space,key_detail,edge_cases,mistakes,code,related_slugs,fork_of,visibility,squad_id,fork_count,created_at,updated_at";

const PRIMER_COLUMNS =
  "id,slug,pattern,title,recognize_when,mental_model,template_md,complexity,mistakes,starter_slugs,author_id,visibility,squad_id,created_at";

/**
 * The full public profile: dimensions plus public teaching, in one call so the
 * page does not flash "no reputation" between three requests.
 *
 * Uses the service client because these rows are public by policy
 * (approaches.visibility = 'public', primers.visibility = 'public'), not
 * because the viewer needs to be someone. The filters are kept explicit rather
 * than relying on RLS so it is obvious a squad-only approach can never be
 * selected here.
 */
export async function getPublicProfile(username: string): Promise<{
  userId: string;
  stats: TeacherStats | null;
  approaches: Approach[];
  primers: Primer[];
} | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!profile) return null;

  const userId = profile.id as string;

  const [statsRes, approachesRes, primersRes] = await Promise.all([
    supabase.from("teacher_stats").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("approaches")
      .select(APPROACH_COLUMNS)
      .eq("user_id", userId)
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("primers")
      .select(PRIMER_COLUMNS)
      .eq("author_id", userId)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    userId,
    stats: (statsRes.data as TeacherStats | null) ?? null,
    approaches: (approachesRes.data ?? []) as Approach[],
    primers: (primersRes.data ?? []) as Primer[],
  };
}
