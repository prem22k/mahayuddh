import { NextResponse } from "next/server";
import { getServiceClient, isAuthorizedCron } from "@/lib/supabase/service";

// Plan Step 2 done-criteria: "activation funnel queryable:
// visit -> first battle -> first solve -> first challenge sent/received".
// Server-only: aggregates product behaviour, so it must never be readable by a
// client key. Same posture as the sync cron routes.
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

function since(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = since(WINDOW_DAYS);

  // One round trip per question is fine here: this page is read by a human
  // reviewing loops (Bible §76), not by the product.
  const [{ data: events, error: evErr }, { count: activeUsers }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("user_id, event, occurred_at")
      .gte("occurred_at", from)
      .limit(20000),
    supabase
      .from("analytics_events")
      .select("user_id", { count: "exact", head: true })
      .gte("occurred_at", from)
      .not("user_id", "is", null),
  ]);

  if (evErr) {
    return NextResponse.json({ error: "Couldn't read analytics" }, { status: 500 });
  }

  const rows = events ?? [];
  const usersWith = (name: string) =>
    new Set(rows.filter((r) => r.event === name && r.user_id).map((r) => r.user_id as string));

  const steps = [
    { name: "visit", users: new Set(rows.filter((r) => r.user_id).map((r) => r.user_id as string)).size },
    { name: "first_battle_started", users: usersWith("first_battle_started").size },
    { name: "battle_started", users: usersWith("battle_started").size },
    { name: "battle_solved", users: usersWith("battle_solved").size },
    { name: "approach_written", users: usersWith("approach_written").size },
    { name: "challenge_sent", users: usersWith("challenge_sent").size },
    { name: "challenge_accepted", users: usersWith("challenge_accepted").size },
    { name: "challenge_completed", users: usersWith("challenge_completed").size },
    { name: "revisit_done", users: usersWith("revisit_done").size },
  ];

  const visitCount = steps[0].users || 1;
  const funnel = steps.map((s) => ({
    ...s,
    pct_of_visit: Math.round((s.users / visitCount) * 1000) / 10,
  }));

  const countsByEvent: Record<string, number> = {};
  for (const r of rows) countsByEvent[r.event] = (countsByEvent[r.event] ?? 0) + 1;

  // §76 review questions: are people practicing, interacting, learning, returning?
  const [{ count: battles }, { count: solves }, { count: challengesSent }, { count: challengesDone }] =
    await Promise.all([
      supabase.from("battles").select("id", { count: "exact", head: true }).gte("started_at", from),
      supabase
        .from("problem_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "solved")
        .gte("created_at", from),
      supabase
        .from("suggestions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", from),
      supabase
        .from("suggestions")
        .select("id", { count: "exact", head: true })
        .not("completed_at", "is", null)
        .gte("completed_at", from),
    ]);

  return NextResponse.json({
    window_days: WINDOW_DAYS,
    since: from,
    active_users: activeUsers ?? 0,
    funnel,
    event_counts: countsByEvent,
    product_totals: {
      battles_started: battles ?? 0,
      problems_solved: solves ?? 0,
      challenges_sent: challengesSent ?? 0,
      challenges_completed: challengesDone ?? 0,
    },
    // Bible §76: the decision is whether a squad repeatedly practices, not MAU.
    north_star:
      challengesDone && challengesSent
        ? Math.round(((challengesDone ?? 0) / (challengesSent ?? 1)) * 1000) / 10
        : null,
  });
}