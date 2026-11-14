/**
 * Review queue — RUNS AGAINST A REAL DATABASE (whatever .env.local points at).
 * Creates a throwaway user and deletes it, and its rows, after.
 *
 * Calls the app's real refreshReviewQueue() as that user (see _libLoader.mjs).
 * It used to upsert with ON CONFLICT on a partial unique index, which Postgres
 * rejects (42P10), so automatic review rows were never saved.
 *
 * Run: npm run test:integration:review
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

const { refreshReviewQueue } = await import("@/lib/data/review");

const tag = `rq${Date.now()}`;
let userId = null;
let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

try {
  const email = `${tag}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = data.user.id;
  await db.from("profiles").insert({ id: userId, username: tag });
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  globalThis.__testSupabase = c;

  // A failed attempt with no solve since: it belongs in the queue.
  const slug = `${tag}-failed`;
  await db.from("user_problem_status").insert({ user_id: userId, problem_slug: slug, status: "attempted" });
  await db.from("problem_events").insert({ user_id: userId, problem_slug: slug, kind: "failed" });

  const first = await refreshReviewQueue();
  check("a failed problem lands in the review queue", first.some((r) => r.problem_slug === slug && r.reason === "failed"), true);

  const second = await refreshReviewQueue();
  check("refreshing again doesn't duplicate it", second.filter((r) => r.problem_slug === slug && r.reason === "failed").length, 1);
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  globalThis.__testSupabase = undefined;
  if (userId) {
    await db.from("review_queue").delete().eq("user_id", userId);
    await db.from("problem_events").delete().eq("user_id", userId);
    await db.from("user_problem_status").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    try { await db.auth.admin.deleteUser(userId); } catch { /* already gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
