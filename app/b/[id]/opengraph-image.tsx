import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";
import { buildPublicCard, BattleCardInput, formatDuration } from "@/lib/battleCard";
import type { Battle, ProblemEvent, Approach, Suggestion, Problem } from "@/types/database";

export const alt = "A shared Mahayuddh battle card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Per-battle OG image (Step 16, §38/§39).
 *
 * Only the public projection is rendered, so a shared link cannot leak a
 * private approach or a squad name into a crawler preview.
 */
export default async function BattleOpengraphImage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const supabase = getServiceClient();

  let title = "Battle";
  let who = "A Mahayuddh developer";
  let duration: string | null = null;
  let pattern: string | null = null;
  let difficulty: string | null = null;
  let attempts = 0;
  let isRecord = false;

  if (supabase) {
    try {
      const { data: battle } = await supabase
        .from("battles")
        .select(
          "id,user_id,problem_slug,squad_id,started_at,ended_at,duration_sec,outcome,self_reported,evidence,confidence,created_at"
        )
        .eq("id", id)
        .maybeSingle();

      if (battle) {
        const slug = (battle.problem_slug as string).toLowerCase();
        const ownerId = battle.user_id as string;

        const [ownerRes, catalogRes, battlesRes, eventsRes, approachesRes, challengesRes] =
          await Promise.all([
            supabase.from("profiles").select("username").eq("id", ownerId).maybeSingle(),
            supabase
              .from("problems")
              .select("title_slug,title,difficulty,topics")
              .eq("title_slug", slug)
              .maybeSingle(),
            supabase
              .from("battles")
              .select("id,problem_slug,started_at,duration_sec,outcome,user_id")
              .eq("user_id", ownerId)
              .eq("problem_slug", slug)
              .order("started_at", { ascending: false })
              .limit(50),
            supabase
              .from("problem_events")
              .select("id,problem_slug,kind,duration_sec,created_at")
              .eq("user_id", ownerId)
              .eq("problem_slug", slug)
              .order("created_at", { ascending: false })
              .limit(100),
            supabase
              .from("approaches")
              .select("id,user_id,problem_slug,core_idea,visibility,created_at")
              .eq("user_id", ownerId)
              .eq("problem_slug", slug)
              .limit(5),
            supabase
              .from("suggestions")
              .select("id,from_user,to_user,problem_slug,status,created_at")
              .or(`from_user.eq.${ownerId},to_user.eq.${ownerId}`)
              .eq("problem_slug", slug)
              .limit(50),
          ]);

        const input: BattleCardInput = {
          battle: battle as Battle,
          ownerUsername: (ownerRes.data as { username: string } | null)?.username ?? null,
          squadName: null,
          problem: (catalogRes.data as Problem | null) ?? null,
          allBattles: (battlesRes.data ?? []) as Battle[],
          events: (eventsRes.data ?? []) as ProblemEvent[],
          approaches: (approachesRes.data ?? []) as Approach[],
          challenges: (challengesRes.data ?? []) as Suggestion[],
        };
        const card = buildPublicCard(input);
        title = card.title;
        who = card.ownerUsername ? `@${card.ownerUsername}` : who;
        duration = formatDuration(card.solvedSec);
        pattern = card.pattern;
        difficulty = card.difficulty;
        attempts = card.stats.attempts;
        isRecord = card.isPersonalRecord;
      }
    } catch {
      // Render the generic card rather than failing the preview.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 55%, #1a150d 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#F5B83D" }}>
            BATTLE
          </div>
          {difficulty ? (
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "4px 16px",
              }}
            >
              {difficulty}
            </div>
          ) : null}
          {pattern ? (
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.42)" }}>{pattern}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#3DDC97", fontFamily: "monospace" }}>
              {duration ?? "—"}
            </div>
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)" }}>
              {who}
              {attempts > 0 ? ` · ${attempts} ${attempts === 1 ? "attempt" : "attempts"}` : ""}
            </div>
          </div>
          {isRecord ? (
            <div
              style={{
                alignSelf: "flex-start",
                fontSize: 24,
                fontWeight: 700,
                color: "#3DDC97",
                border: "1px solid rgba(61,220,151,0.4)",
                borderRadius: 999,
                padding: "6px 18px",
              }}
            >
              Personal best
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
          Mahayuddh — practice DSA with your people
        </div>
      </div>
    ),
    { ...size }
  );
}