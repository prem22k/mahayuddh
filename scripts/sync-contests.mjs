/**
 * Contest ingest (Step 23, Bible §36).
 *
 * Reads data/contests.json and upserts it. Nothing is fetched from LeetCode:
 * the execution plan says "manual LeetCode contest calendar entry v0, no
 * scraping", and scraping would be fragile and a terms problem.
 *
 * Idempotent. `contests` has a unique index on (starts_at, platform) and the
 * upsert uses that conflict target, so running this twice cannot produce two
 * reminders for one week — which matters because the reminder function is
 * called on a cron and a duplicate contest row would mean a duplicate push.
 *
 * Run: node scripts/sync-contests.mjs [--file data/contests.json] [--dry-run]
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PLATFORMS = ["leetcode", "codeforces", "other"];

/** Contests further out than this are not worth a reminder yet. */
const HORIZON_DAYS = 45;

/** Entries older than this are dropped: an old calendar must not spam anyone. */
const MAX_PAST_DAYS = 14;

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

/**
 * Validate one entry.
 *
 * Returns a reason string when it should be skipped, or null when it is usable.
 * The checks are explicit rather than trusting the JSON: a typo in this file
 * would otherwise become a reminder with "Invalid Date" in the body.
 */
export function validateContest(c, now = new Date()) {
  if (!c || typeof c !== "object") return "not an object";
  if (typeof c.title !== "string" || c.title.trim().length === 0) return "missing title";
  if (c.title.length > 120) return "title longer than 120 characters";

  const at = new Date(c.starts_at);
  if (Number.isNaN(at.getTime())) return `starts_at is not a date: ${c.starts_at}`;

  const platform = c.platform ?? "leetcode";
  if (!PLATFORMS.includes(platform)) return `unknown platform: ${platform}`;

  if (c.url != null && !/^https?:\/\//.test(String(c.url))) return "url is not http(s)";

  const ageDays = (now.getTime() - at.getTime()) / 86_400_000;
  if (ageDays > MAX_PAST_DAYS) return `starts in the past (${Math.round(ageDays)} days ago)`;
  if (-ageDays > HORIZON_DAYS) return `more than ${HORIZON_DAYS} days out`;

  return null;
}

export function parseCalendar(raw) {
  const doc = JSON.parse(raw);
  const list = Array.isArray(doc) ? doc : doc.contests;
  if (!Array.isArray(list)) {
    throw new Error('calendar must be an array or an object with a "contests" array');
  }
  const now = new Date();
  const kept = [];
  const skipped = [];
  const seen = new Set();

  for (const c of list) {
    const reason = validateContest(c, now);
    if (reason) {
      skipped.push({ title: c?.title ?? "(no title)", reason });
      continue;
    }
    const platform = c.platform ?? "leetcode";
    const startsAt = new Date(c.starts_at).toISOString();
    // Dedup inside the file too: the unique index would refuse the second one
    // anyway, but reporting it is more useful than a constraint violation.
    const key = `${startsAt}|${platform}`;
    if (seen.has(key)) {
      skipped.push({ title: c.title, reason: "duplicate of an earlier entry in this file" });
      continue;
    }
    seen.add(key);
    kept.push({
      title: c.title.trim(),
      starts_at: startsAt,
      platform,
      url: c.url ?? null,
    });
  }

  // Chronological, so the summary a human reads matches the calendar.
  kept.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return { kept, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.indexOf("--file");
  const file = fileArg !== -1 ? args[fileArg + 1] : "data/contests.json";

  const { kept, skipped } = parseCalendar(readFileSync(file, "utf8"));

  console.log(`${file}: ${kept.length} usable, ${skipped.length} skipped`);
  for (const s of skipped) console.log(`  skip ${s.title}: ${s.reason}`);

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    for (const c of kept) console.log(`  ${c.starts_at}  ${c.title}`);
    return;
  }

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");

  const db = createClient(url, key, { auth: { persistSession: false } });

  // onConflict on (starts_at, platform), which is the unique index. A re-ingest
  // updates the title/url instead of inserting a second row for the same week.
  const { data, error } = await db
    .from("contests")
    .upsert(kept, { onConflict: "starts_at,platform" })
    .select("id,title,starts_at,platform");

  if (error) {
    console.error("upsert failed:", error.message);
    process.exit(1);
  }

  console.log(`\nwrote ${(data ?? []).length} contests`);
  for (const c of data ?? []) console.log(`  ${c.starts_at}  ${c.title}`);

  const { count } = await db.from("contests").select("id", { count: "exact", head: true });
  console.log(`\n${count} contests in the table now`);
}

// Only run when invoked directly, so the parse/validate helpers stay importable.
if (process.argv[1] && process.argv[1].endsWith("sync-contests.mjs")) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}