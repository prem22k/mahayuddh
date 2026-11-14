/**
 * my_streak() — RUNS AGAINST A REAL DATABASE (whatever .env.local points at).
 * Creates a throwaway user and solve history and deletes them on the way out.
 *
 * Pins the sidebar's streak: your own consecutive IST days with a solve or
 * revisit, alive while the last one is today or yesterday, and never
 * LeetCode's longest streak or an undated LeetCode import.
 *
 * Run: npm run test:integration:streak
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("missing supabase env");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const tag = `stk${Date.now()}`;
let userId = null;

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

/** Noon IST, `daysAgo` IST days before today: safely inside that IST day. */
function istNoon(daysAgo) {
  const IST = 5.5 * 3600_000;
  const DAY = 86_400_000;
  const todayIst = Math.floor((Date.now() + IST) / DAY);
  return new Date((todayIst - daysAgo) * DAY + 12 * 3600_000 - IST).toISOString();
}

async function solveOn(daysAgo, kind = "solved", metadata = {}) {
  const { error } = await db.from("problem_events").insert({
    user_id: userId, problem_slug: `${tag}-p${daysAgo}`, kind, metadata, created_at: istNoon(daysAgo),
  });
  if (error) throw new Error(`problem event: ${error.message}`);
}

try {
  const email = `${tag}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = data.user.id;
  // LeetCode's longest streak on the profile must not leak into this one.
  await db.from("profiles").insert({ id: userId, username: tag, streak: 42 });

  const me = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await me.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  const streak = async () => {
    const { data: rows, error: rErr } = await me.rpc("my_streak");
    if (rErr) throw new Error(`my_streak: ${rErr.message}`);
    return rows[0];
  };

  check("no solves: no streak", await streak(), { current_streak: 0, best_streak: 0, solved_today: false });

  // A 3-day run a week ago, then yesterday and the day before.
  for (const d of [7, 6, 5]) await solveOn(d);
  await solveOn(2);
  await solveOn(1, "revisited");
  check("a run ending yesterday is alive; the older run is the best", await streak(), {
    current_streak: 2, best_streak: 3, solved_today: false,
  });

  // An undated LeetCode import today is not practice.
  await solveOn(0, "solved", { source: "self", imported: true });
  check("an imported solve doesn't count as solving today", (await streak()).solved_today, false);

  await solveOn(0);
  check("solving today extends the streak and marks today", await streak(), {
    current_streak: 3, best_streak: 3, solved_today: true,
  });
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  if (userId) {
    await db.from("problem_events").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    try { await db.auth.admin.deleteUser(userId); } catch { /* already gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
