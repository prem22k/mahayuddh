/**
 * One feed row per action — RUNS AGAINST A REAL DATABASE (whatever .env.local
 * points at). Creates a throwaway user, squad, battle and rows, and deletes
 * them on the way out.
 *
 * Calls the app's real data functions as a signed-in user (see _libLoader.mjs):
 *   - createStuckRequest() writes the ask's only feed row, carrying the title
 *     and caption the composer used to log as a second row
 *   - shareSolvedBattle() replaces the dock's automatic row for that solve
 *     instead of adding a second "solved" row beside it
 *
 * Run: npm run test:integration:dupes
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

const { createStuckRequest } = await import("@/lib/data/stuck");
const { shareSolvedBattle } = await import("@/lib/data/composer");

const tag = `dup${Date.now()}`;
let userId = null;
let squadId = null;

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

/** createStuckRequest logs its feed row without awaiting it; wait for it to land. */
async function rowsFor(filter, want = 1) {
  for (let i = 0; i < 20; i++) {
    const { data } = await filter(db.from("feed_events").select("id,event_type,problem_title,object_type,metadata"));
    if ((data ?? []).length >= want) {
      await new Promise((r) => setTimeout(r, 500)); // a late second row would land by now
      const { data: settled } = await filter(db.from("feed_events").select("id,event_type,problem_title,object_type,metadata"));
      return settled ?? [];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return [];
}

try {
  const email = `${tag}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = data.user.id;
  await db.from("profiles").insert({ id: userId, username: tag });
  const { data: sq, error: sErr } = await db
    .from("squads").insert({ name: `dup-${tag}`, invite_code: `${tag}-s`, created_by: userId }).select("id").single();
  if (sErr) throw new Error(`squad: ${sErr.message}`);
  squadId = sq.id;
  await db.from("squad_members").insert({ squad_id: squadId, user_id: userId });
  await db.from("profiles").update({ active_squad_id: squadId }).eq("id", userId);

  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: inErr } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  globalThis.__testSupabase = c;

  // ── Stuck ask: one row, with title and caption ───────────────────────────
  const res = await createStuckRequest({
    problemSlug: `${tag}-stuck`, level: "nudge", visibility: "squad", squadId,
    problemTitle: "Probe Stuck", caption: "Stuck on the edge case",
  });
  if (!res.ok) throw new Error(`createStuckRequest: ${res.error}`);
  const stuckRows = await rowsFor((q) => q.eq("user_id", userId).eq("event_type", "stuck"));
  check("a stuck ask makes exactly one feed row", stuckRows.length, 1);
  check("that row carries the problem title", stuckRows[0]?.problem_title ?? null, "Probe Stuck");
  check("that row carries the caption", stuckRows[0]?.metadata?.caption ?? null, "Stuck on the edge case");

  // ── Shared solve: replaces the dock's row ────────────────────────────────
  const slug = `${tag}-solve`;
  const endedAt = new Date().toISOString();
  const { data: battle, error: bErr } = await db.from("battles").insert({
    user_id: userId, problem_slug: slug, squad_id: squadId, outcome: "solved",
    ended_at: endedAt, duration_sec: 600, evidence: "none",
  }).select("id,problem_slug,duration_sec,outcome,evidence,started_at").single();
  if (bErr) throw new Error(`battle: ${bErr.message}`);
  // What the dock writes when the battle ends.
  await db.from("feed_events").insert({
    user_id: userId, event_type: "solve", problem_slug: slug, squad_id: squadId,
    metadata: { duration_sec: 600, source: "none" }, created_at: endedAt,
  });

  const shared = await shareSolvedBattle(battle, "Two pointers, finally");
  if (!shared.ok) throw new Error(`shareSolvedBattle: ${shared.error}`);
  const { data: solveRows } = await db
    .from("feed_events").select("object_type,metadata").eq("user_id", userId).eq("event_type", "solve").eq("problem_slug", slug);
  check("sharing a solve leaves one solve row, not two", (solveRows ?? []).length, 1);
  check("the row left is the shared one, with its caption", solveRows?.[0]?.metadata?.caption ?? null, "Two pointers, finally");
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  globalThis.__testSupabase = undefined;
  if (userId) {
    await db.from("feed_events").delete().eq("user_id", userId);
    await db.from("stuck_requests").delete().eq("user_id", userId);
    await db.from("battles").delete().eq("user_id", userId);
  }
  if (squadId) await db.from("squads").delete().eq("id", squadId);
  if (userId) {
    await db.from("profiles").delete().eq("id", userId);
    try { await db.auth.admin.deleteUser(userId); } catch { /* already gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
