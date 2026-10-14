import { NextResponse } from "next/server";
import { getServiceClient, isAuthorizedCron } from "@/lib/supabase/service";
import { readJsonBounded } from "@/lib/security/body";
import { inQuietHoursIST } from "@/lib/quietHours";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
// Bounded by construction: one cron run notifies at most this many people,
// no matter how large the tables grow.
const MAX_NUDGES = 200;

interface Nudge {
  userId: string;
  title: string;
  body: string;
  deepLink: string;
  dedupeKey: string;
}

/**
 * POST /api/cron/streak-nudges
 *
 * Daily growth nudges (Wave D): streak-at-risk, "squad solved without you",
 * and the 3/7/14-day lapsed digest. Authorized by the cron secret, never by a
 * session — GitHub Actions calls it with a bearer token (see sync.yml).
 *
 * Delivery goes through the same store the notify() path writes
 * (public.notifications, kind 'nudge') plus the same push fan-out, so the
 * bell and the push permission flow treat these like every other notice.
 * dedupe_key carries the subtype and the date, so the partial unique index on
 * (user_id, kind, dedupe_key) collapses repeats to one open notice per day.
 *
 * Quiet hours are NOT reimplemented here: the route asks the shared IST
 * helper in lib/quietHours (owned and fixed by the parallel task) and
 * skips when it says so. Batchable nudges wait for morning; nothing here is
 * time-critical.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bounded body even though this route takes no input: the static baseline
  // forbids parsing the body without a cap anywhere outside the one
  // documented exception, so this goes through the bounded reader.
  const parsed = await readJsonBounded(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  // Quiet hours via the shared IST helper (lib/quietHours, owned by the
  // parallel correctness wave) — never reimplemented here. Batchable nudges
  // wait for morning; nothing in this route is time-critical.
  if (inQuietHoursIST(new Date())) {
    return NextResponse.json({ skipped: "quiet_hours" });
  }

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);

  // Last solve per user, from the append-only history (15-day window covers
  // the 14-day digest with room for clock skew).
  const { data: solveRows, error: solvesErr } = await supabase
    .from("problem_events")
    .select("user_id, created_at")
    .eq("kind", "solved")
    .gte("created_at", new Date(now - 15 * DAY_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  if (solvesErr || !solveRows) {
    return NextResponse.json({ error: "Couldn't read solve history" }, { status: 500 });
  }
  const lastSolve = new Map<string, string>();
  for (const row of solveRows as { user_id: string; created_at: string }[]) {
    if (!lastSolve.has(row.user_id)) lastSolve.set(row.user_id, row.created_at);
  }

  // Squad rosters, bounded.
  const { data: memberRows } = await supabase
    .from("squad_members")
    .select("squad_id, user_id")
    .limit(2000);
  const roster = new Map<string, string[]>();
  for (const m of (memberRows ?? []) as { squad_id: string; user_id: string }[]) {
    const list = roster.get(m.squad_id) ?? [];
    if (list.length < 8) list.push(m.user_id);
    roster.set(m.squad_id, list);
  }

  // Who solved in the last 24h, bounded.
  const { data: recentRows } = await supabase
    .from("problem_events")
    .select("user_id")
    .eq("kind", "solved")
    .gte("created_at", new Date(now - DAY_MS).toISOString())
    .limit(2000);
  const solvedToday = new Set(
    ((recentRows ?? []) as { user_id: string }[]).map((r) => r.user_id)
  );

  // Names for the "without you" copy, bounded to the solvers we may mention.
  const solverIds = [...solvedToday].slice(0, 200);
  const usernameById = new Map<string, string>();
  if (solverIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", solverIds);
    for (const p of (profiles ?? []) as { id: string; username: string }[]) {
      usernameById.set(p.id, p.username);
    }
  }
  const squadNameById = new Map<string, string>();
  const squadIds = [...roster.keys()].slice(0, 200);
  if (squadIds.length > 0) {
    const { data: squads } = await supabase.from("squads").select("id, name").in("id", squadIds);
    for (const s of (squads ?? []) as { id: string; name: string }[]) {
      squadNameById.set(s.id, s.name);
    }
  }

  const nudges: Nudge[] = [];
  const push = (n: Nudge) => {
    if (nudges.length < MAX_NUDGES) nudges.push(n);
  };

  // Streak at risk: last solve 20–30h ago. Under 20h the day is still young;
  // past 30h the streak copy no longer applies (the lapsed digest takes over).
  for (const [userId, at] of lastSolve) {
    const ageH = (now - Date.parse(at)) / 3_600_000;
    if (ageH >= 20 && ageH < 30) {
      push({
        userId,
        title: "Streak at risk",
        body: "Your last solve was yesterday. One battle today keeps it alive.",
        deepLink: "/home",
        dedupeKey: `nudge:streak-risk:${today}`,
      });
    }
  }

  // Squad solved without you: at least one teammate solved in the last 24h
  // and you did not.
  for (const [squadId, ids] of roster) {
    const solvers = ids.filter((id) => solvedToday.has(id));
    if (solvers.length === 0) continue;
    const names = solvers.slice(0, 2).map((id) => `@${usernameById.get(id) ?? "teammate"}`);
    const squadName = squadNameById.get(squadId) ?? "Your squad";
    for (const id of ids) {
      if (solvedToday.has(id)) continue;
      push({
        userId: id,
        title: `${squadName} solved without you`,
        body: `${names.join(" and ")} solved today. Join them before midnight.`,
        deepLink: `/squad/${squadId}`,
        dedupeKey: `nudge:squad-without-you:${squadId}:${today}`,
      });
    }
  }

  // Lapsed digest: exactly 3, 7, or 14 days since the last solve.
  for (const [userId, at] of lastSolve) {
    const ageDays = Math.floor((now - Date.parse(at)) / DAY_MS);
    if (ageDays === 3 || ageDays === 7 || ageDays === 14) {
      const span = ageDays === 7 ? "A week" : ageDays === 14 ? "Two weeks" : `${ageDays} days`;
      push({
        userId,
        title: `${span} since your last solve`,
        body: "Your squad is still practicing. Start today's battle to rejoin the streak.",
        deepLink: "/home",
        dedupeKey: `nudge:lapsed-${ageDays}:${today}`,
      });
    }
  }

  const { sendPushToUser } = await import("@/lib/push");
  let stored = 0;
  let skipped = 0;
  const pushes: Promise<unknown>[] = [];
  for (const n of nudges) {
    const { error } = await supabase.from("notifications").insert({
      user_id: n.userId,
      kind: "nudge",
      title: n.title,
      body: n.body,
      deep_link: n.deepLink,
      dedupe_key: n.dedupeKey,
    });
    if (error) {
      // 23505 is the dedupe index doing its job (already nudged today).
      skipped += 1;
      continue;
    }
    stored += 1;
    pushes.push(
      sendPushToUser(n.userId, { title: n.title, body: n.body, url: n.deepLink }).catch(() => null)
    );
  }
  await Promise.allSettled(pushes);

  return NextResponse.json({ ok: true, date: today, considered: nudges.length, stored, skipped });
}
