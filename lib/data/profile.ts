// CLIENT-SAFE. This module is imported by client components (FollowButton), so
// it must never import lib/supabase/service — that pulls next/headers into the
// browser bundle and fails the build. Server-only readers live in
// lib/data/profilePublic.ts. This has now bitten twice; the build catches it,
// but the split is the fix.
import { createClient } from "@/lib/supabase/client";
import type { TeacherStats } from "@/lib/reputation";
import type { Approach, Primer } from "@/types/database";
import { DataError } from "@/lib/data/errors";

/**
 * Step 22 reads (§21, §22).
 *
 * teacher_stats is a view over rows that already exist (§63) rather than a
 * stored counter, so it cannot drift from the activity it describes.
 */

export async function isFollowing(followedId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", user.id)
    .eq("followed_id", followedId)
    .maybeSingle();
  return Boolean(data);
}

export async function toggleFollow(followedId: string, follow: boolean): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new DataError("feed", "Log in to follow.");
  if (follow) {
    const { error } = await supabase.from("follows").insert({ followed_id: followedId });
    // 23505 = already following. Treat it as success: the desired state holds.
    if (error && error.code !== "23505") {
      throw new DataError("feed", "Couldn't follow.", { cause: error });
    }
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followed_id", followedId);
    if (error) throw new DataError("feed", "Couldn't unfollow.", { cause: error });
  }
}


export async function getTeacherStats(userId: string): Promise<TeacherStats | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("teacher_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new DataError("profile", "Couldn't load reputation. Retry.", { cause: error });
  return (data as TeacherStats | null) ?? null;
}

export interface Teacher {
  user_id: string;
  username: string;
  avatar_url: string | null;
  approaches: number;
  primers: number;
  note_forks: number;
  primer_forks: number;
  challenge_completions: number;
}

/**
 * "People who teach it" for a pattern page (§22).
 *
 * Ordered by forks and completed challenges inside SQL — downstream use, not
 * followers, and not a collapsed score.
 */
export async function getTeachersForPattern(pattern: string, limit = 8): Promise<Teacher[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("teachers_for_pattern", {
    p_pattern: pattern,
    p_limit: limit,
  });
  if (error) throw new DataError("profile", "Couldn't load teachers. Retry.", { cause: error });
  return (data ?? []) as Teacher[];
}

/** Their public teaching, for the profile page. */
export async function getPublicTeaching(
  userId: string
): Promise<{ approaches: Approach[]; primers: Primer[] }> {
  const supabase = createClient();
  const [approachesRes, primersRes] = await Promise.all([
    supabase
      .from("approaches")
      .select("id,user_id,problem_slug,pattern,core_idea,complexity_time,complexity_space,key_detail,edge_cases,mistakes,code,related_slugs,fork_of,visibility,squad_id,fork_count,created_at,updated_at")
      .eq("user_id", userId)
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("primers")
      .select("id,slug,pattern,title,recognize_when,mental_model,template_md,complexity,mistakes,starter_slugs,author_id,visibility,squad_id,created_at")
      .eq("author_id", userId)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (approachesRes.error) {
    throw new DataError("profile", "Couldn't load approaches. Retry.", { cause: approachesRes.error });
  }
  return {
    approaches: (approachesRes.data ?? []) as Approach[],
    primers: (primersRes.data ?? []) as Primer[],
  };
}
