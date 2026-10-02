import { NextResponse } from "next/server";
import { getServiceClient, isAuthorizedCron } from "@/lib/supabase/service";
import { parseCalendar } from "@/scripts/sync-contests.mjs";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/contests
 *
 * Step 23 / §36. Two jobs in one call, because they must happen in order:
 *
 *   1. Upsert the checked-in calendar (data/contests.json) into `contests`.
 *   2. Fire reminders for anything starting inside the next 24 hours.
 *
 * The plan says "manual LeetCode contest calendar entry v0, no scraping", so
 * step 1 reads a file in this repository and nothing else. The file is imported
 * rather than re-read from disk because a serverless bundle has no reliable
 * working directory, and the parsing helpers live with the script so the two
 * paths cannot disagree about what a valid entry is.
 *
 * Reminders are idempotent by dedupe_key, so this route is safe to run as often
 * as the scheduler likes — running it twice in a minute sends nothing extra.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  // 1. Ingest the calendar.
  let ingested = 0;
  let skipped: { title: string; reason: string }[] = [];
  try {
    const mod = await import("@/data/contests.json");
    const parsed = parseCalendar(JSON.stringify(mod.default ?? mod));
    skipped = parsed.skipped;
    if (parsed.kept.length > 0) {
      const { data, error } = await supabase
        .from("contests")
        .upsert(parsed.kept, { onConflict: "starts_at,platform" })
        .select("id");
      if (error) {
        return NextResponse.json({ error: `contest ingest failed: ${error.message}` }, { status: 500 });
      }
      ingested = (data ?? []).length;
    }
  } catch (err) {
    // A bad calendar file must not stop reminders for contests already in the
    // table. Report it and carry on to step 2.
    const message = err instanceof Error ? err.message : String(err);
    skipped = [{ title: "data/contests.json", reason: message }];
  }

  // 2. Fire reminders.
  const { data: reminded, error: remindErr } = await supabase.rpc("notify_contest_reminders", {
    p_within: "24:00:00",
  });
  if (remindErr) {
    return NextResponse.json(
      { error: `reminders failed: ${remindErr.message}`, ingested, skipped },
      { status: 500 }
    );
  }

  const { count } = await supabase.from("contests").select("id", { count: "exact", head: true });

  return NextResponse.json({
    ok: true,
    ingested,
    skipped,
    remindersSent: reminded ?? 0,
    contestsInTable: count ?? 0,
  });
}