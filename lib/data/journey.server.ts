/**
 * SERVER-ONLY. Reads for /u/[username] and its OG image.
 *
 * Split out of the old lib/data/journey.ts because the personal-journey reader
 * is client-safe (browser Supabase client) and this module uses the service
 * client, which pulls next/headers into the browser bundle. Follows the
 * lib/data/profile.ts vs lib/data/profilePublic.ts split pattern.
 */
import { getServiceClient } from "@/lib/supabase/service";
import { findProfileByUsername } from "@/lib/profiles/username";
import { buildJourney, JourneyBody, journeyWindow } from "@/lib/journey";
import type { Approach, Battle, ProblemEvent, StuckRequest, Suggestion } from "@/types/database";

/**
 * Server-side read for the public journey page and its OG image.
 * Returns null when there is nothing worth showing — an empty journey card is
 * not worth sharing.
 */
export async function getPublicJourney(
  username: string,
  days = 30
): Promise<JourneyBody | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const profile = await findProfileByUsername(supabase, username);
  if (!profile) return null;

  const userId = profile.id;
  const w = journeyWindow(days);
  const from = `${w.from}T00:00:00.000Z`;
  const to = `${w.to}T23:59:59.999Z`;

  const [eventsRes, battlesRes, approachesRes, challengesRes, stuckRes] = await Promise.all([
    supabase
      .from("problem_events")
      .select("id,user_id,problem_slug,kind,battle_id,duration_sec,metadata,created_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(5000),
    supabase
      .from("battles")
      .select("id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at")
      .eq("user_id", userId)
      .gte("started_at", from)
      .lte("started_at", to)
      .limit(2000),
    supabase
      .from("approaches")
      .select("id,user_id,problem_slug,pattern,visibility,created_at,updated_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .limit(500),
    supabase
      .from("suggestions")
      .select("id,from_user,to_user,problem_slug,problem_title,difficulty,status,created_at,completed_at")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .gte("created_at", from)
      .limit(500),
    supabase
      .from("stuck_requests")
      .select("id,user_id,problem_slug,battle_id,level,visibility,squad_id,status,last_reminded_at,created_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .limit(200),
  ]);

  const events = (eventsRes.data ?? []) as ProblemEvent[];
  if (events.length === 0 && (battlesRes.data ?? []).length === 0) return null;

  const slugs = Array.from(new Set(events.map((e) => e.problem_slug))).slice(0, 500);
  const problemPattern = new Map<string, string>();
  if (slugs.length > 0) {
    const { data: catalog } = await supabase
      .from("problems")
      .select("title_slug, topics")
      .in("title_slug", slugs);
    for (const p of (catalog ?? []) as { title_slug: string; topics: string[] }[]) {
      if (p.topics?.length) problemPattern.set(p.title_slug, p.topics[0]);
    }
  }

  return buildJourney({
    days,
    userId,
    username: profile.username as string,
    events,
    battles: (battlesRes.data ?? []) as Battle[],
    approaches: (approachesRes.data ?? []) as Approach[],
    challenges: (challengesRes.data ?? []) as Suggestion[],
    stuck: (stuckRes.data ?? []) as StuckRequest[],
    problemPattern,
  });
}
