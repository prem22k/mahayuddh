import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { readJsonBounded } from "@/lib/security/body";

// POST /api/leaderboard/snapshot — freeze today's ranks for one view.
//
// The board has no rank-history source, so the client sends the order it just
// rendered and this route stores it once per (scope, metric, day). The guard
// is checked here, not just in lib/data/leaderboard.ts, because the client
// check is a courtesy and this one is the arbiter: a re-send on the same day
// is a no-op, and two racers resolve on the unique index with the loser
// reporting "skipped" rather than an error.
//
// Writes use the service key (the table has no client insert policy), so the
// caller must be signed in; the payload is fully re-validated below.

const SCOPE_RE = /^[a-z0-9:_-]{1,64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROWS = 100;

interface SnapshotRowInput {
  user_id?: unknown;
  rank?: unknown;
  value?: unknown;
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "/api/leaderboard/snapshot");
  if (auth.response) return auth.response;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const parsed = await readJsonBounded<{ scope?: unknown; metric?: unknown; rows?: unknown }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = parsed.value;
  const scope = body?.scope;
  const metric = body?.metric;
  const rows = body?.rows;
  if (typeof scope !== "string" || !SCOPE_RE.test(scope)) {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }
  if (typeof metric !== "string" || !SCOPE_RE.test(metric)) {
    return NextResponse.json({ error: "Invalid metric." }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
    return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  const clean: Array<{
    scope: string;
    metric: string;
    user_id: string;
    rank: number;
    value: number;
    snapshot_date: string;
  }> = [];

  for (const raw of rows as SnapshotRowInput[]) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
    }
    if (typeof raw.user_id !== "string" || !UUID_RE.test(raw.user_id)) {
      return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
    }
    if (!Number.isInteger(raw.rank) || (raw.rank as number) < 1 || (raw.rank as number) > 10000) {
      return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
    }
    // -1 is the client's sentinel for "no rating"; otherwise a plain count.
    if (!Number.isInteger(raw.value) || (raw.value as number) < -1 || (raw.value as number) > 1000000) {
      return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
    }
    if (seen.has(raw.user_id)) continue;
    seen.add(raw.user_id);
    clean.push({
      scope,
      metric,
      user_id: raw.user_id,
      rank: raw.rank as number,
      value: raw.value as number,
      snapshot_date: today,
    });
  }

  if (clean.length === 0) {
    return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
  }

  const { data: existing, error: checkError } = await supabase
    .from("leaderboard_snapshots")
    .select("id")
    .eq("scope", scope)
    .eq("metric", metric)
    .eq("snapshot_date", today)
    .limit(1);
  if (checkError) {
    return NextResponse.json({ error: "Couldn't save snapshot." }, { status: 500 });
  }
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { error: insertError } = await supabase.from("leaderboard_snapshots").insert(clean);
  if (insertError) {
    // A concurrent writer froze the day first; that is success, not conflict.
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    return NextResponse.json({ error: "Couldn't save snapshot." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inserted: clean.length });
}
