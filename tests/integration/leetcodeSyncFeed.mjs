/**
 * LeetCode sync → history and feed — RUNS AGAINST A REAL DATABASE (whatever
 * .env.local points at). Creates a throwaway user and squad and deletes them,
 * and everything they wrote, on the way out.
 *
 * Pins mark_solved_from_leetcode (20261114000003):
 *   - a solve with a known time is recorded at that time, not at sync time
 *   - a solve from the last 48 hours gets a named feed row
 *   - older or undated solves become one "synced N solves" row, never one
 *     nameless row each
 *   - an undated import is dated before the user joined, so it never counts
 *     as today's or this week's work
 *
 * Run: npm run test:integration:lcsync
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
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!env.NEXT_PUBLIC_SUPABASE_URL || !serviceKey) throw new Error("missing supabase env");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

const tag = `lcs${Date.now()}`;
const made = { users: [], squads: [] };

async function cleanup() {
  for (const u of made.users) {
    await db.from("feed_events").delete().eq("user_id", u);
    await db.from("problem_events").delete().eq("user_id", u);
    await db.from("user_problem_status").delete().eq("user_id", u);
  }
  for (const s of made.squads) await db.from("squads").delete().eq("id", s);
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* already gone */ }
  }
}

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}
const ms = (iso) => new Date(iso).getTime();

try {
  const { data: u, error: uErr } = await db.auth.admin.createUser({
    email: `${tag}@probe.test`, password: "probe-pw-123", email_confirm: true,
  });
  if (uErr) throw new Error(`createUser: ${uErr.message}`);
  const userId = u.user.id;
  made.users.push(userId);
  await db.from("profiles").insert({ id: userId, username: tag });
  const { data: sq, error: sErr } = await db
    .from("squads").insert({ name: `lcs-${tag}`, invite_code: `${tag}-s`, created_by: userId }).select("id").single();
  if (sErr) throw new Error(`squad: ${sErr.message}`);
  made.squads.push(sq.id);
  await db.from("squad_members").insert({ squad_id: sq.id, user_id: userId });
  await db.from("profiles").update({ active_squad_id: sq.id }).eq("id", userId);
  const { data: prof } = await db.from("profiles").select("created_at").eq("id", userId).single();

  const { data: probs } = await db.from("problems").select("title_slug,title").eq("paid_only", false).limit(3);
  if (!probs || probs.length < 3) throw new Error("needs 3 catalog problems");
  const [recent, old, undated] = probs;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const tenDaysAgo = new Date(Date.now() - 10 * 86400_000).toISOString();

  // One sync: a solve from an hour ago, one from ten days ago, one with no time.
  const { error: rpcErr } = await db.rpc("mark_solved_from_leetcode", {
    p_user_id: userId,
    p_slugs: [recent.title_slug, old.title_slug, undated.title_slug],
    p_solved_at: [hourAgo, tenDaysAgo, null],
  });
  if (rpcErr) throw new Error(`rpc: ${rpcErr.message}`);

  const { data: feed } = await db
    .from("feed_events").select("problem_slug,problem_title,object_type,metadata,created_at").eq("user_id", userId);
  const named = (feed ?? []).filter((f) => f.object_type === "problem");
  const summary = (feed ?? []).filter((f) => f.object_type === "import");

  check("the recent solve gets one named feed row", named.map((f) => f.problem_slug), [recent.title_slug]);
  check("that row carries the problem's title", named[0]?.problem_title ?? null, recent.title);
  check("that row is dated when it was solved, not when the sync ran", ms(named[0]?.created_at), ms(hourAgo));
  check("older and undated solves become one summary row", summary.length, 1);
  check("the summary row counts them", summary[0]?.metadata?.count ?? null, 2);
  check("no feed row is left without a problem name", (feed ?? []).filter((f) => f.object_type === "problem" && !f.problem_slug).length, 0);

  const { data: hist } = await db
    .from("problem_events").select("problem_slug,created_at,metadata").eq("user_id", userId).eq("kind", "solved");
  const at = (slug) => (hist ?? []).find((h) => h.problem_slug === slug);
  check("history records the ten-day-old solve at its own time", ms(at(old.title_slug)?.created_at), ms(tenDaysAgo));
  check("an undated import is dated before the user joined", ms(at(undated.title_slug)?.created_at) < ms(prof.created_at), true);
  check("an undated import is marked imported", at(undated.title_slug)?.metadata?.imported ?? null, true);

  const { data: status } = await db
    .from("user_problem_status").select("problem_slug,solved_at").eq("user_id", userId).eq("problem_slug", recent.title_slug).single();
  check("the status's solved_at is the solve time", ms(status.solved_at), ms(hourAgo));

  // A second sync of the same slugs adds nothing.
  await db.rpc("mark_solved_from_leetcode", {
    p_user_id: userId,
    p_slugs: [recent.title_slug, old.title_slug, undated.title_slug],
    p_solved_at: [hourAgo, tenDaysAgo, null],
  });
  const { count } = await db.from("feed_events").select("id", { count: "exact", head: true }).eq("user_id", userId);
  check("re-syncing the same solves adds no feed rows", count, (feed ?? []).length);
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
