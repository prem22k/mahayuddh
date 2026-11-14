/**
 * Recap rewrites — RUNS AGAINST A REAL DATABASE (whatever .env.local points
 * at). Creates two throwaway members, a squad and recaps, and deletes them.
 *
 * Calls the app's real generateRecap() as each member (see _libLoader.mjs):
 *   - a second member can rewrite this week's recap (it used to fail with
 *     "Couldn't save that recap")
 *   - nobody can rewrite a week that has ended: "Frozen" on the page is true
 *
 * Run: npm run test:integration:recaps
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

const { generateRecap } = await import("@/lib/data/recap");

const tag = `rcp${Date.now()}`;
const made = { users: [], squads: [] };

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

async function makeUser(i) {
  const email = `${tag}_${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  await db.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}` });
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  return { id: data.user.id, client: c };
}

async function as(user, fn) {
  globalThis.__testSupabase = user.client;
  try {
    return await fn(user.client);
  } finally {
    globalThis.__testSupabase = undefined;
  }
}

try {
  const a = await makeUser(1);
  const b = await makeUser(2);
  const { data: sq, error: sErr } = await db
    .from("squads").insert({ name: `rcp-${tag}`, invite_code: `${tag}-s`, created_by: a.id }).select("id").single();
  if (sErr) throw new Error(`squad: ${sErr.message}`);
  made.squads.push(sq.id);
  await db.from("squad_members").insert([{ squad_id: sq.id, user_id: a.id }, { squad_id: sq.id, user_id: b.id }]);

  // This week: A writes it, then B rewrites it.
  await as(a, () => generateRecap(sq.id, "Probe"));
  let bError = null;
  try {
    await as(b, () => generateRecap(sq.id, "Probe"));
  } catch (e) {
    bError = e.message;
  }
  check("a second member can rewrite this week's recap", bError, null);
  const { data: rows } = await db.from("squad_recaps").select("generated_by").eq("squad_id", sq.id);
  check("there is still one recap for the week, now B's", rows?.map((r) => r.generated_by), [b.id]);

  // A finished week: nobody can change it, not even whoever wrote it.
  const { data: past, error: pErr } = await db.from("squad_recaps").insert({
    squad_id: sq.id, week_start: "2026-01-05", week_end: "2026-01-11",
    body_json: { solves: 7 }, generated_by: a.id,
  }).select("id").single();
  if (pErr) throw new Error(`past recap: ${pErr.message}`);
  for (const [who, user] of [["its writer", a], ["another member", b]]) {
    await as(user, (c) =>
      c.from("squad_recaps").update({ body_json: { solves: 99 }, generated_by: user.id }).eq("id", past.id)
    );
    const { data: after } = await db.from("squad_recaps").select("body_json").eq("id", past.id).single();
    check(`${who} cannot rewrite a finished week`, after.body_json.solves, 7);
  }
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  for (const s of made.squads) {
    await db.from("squad_recaps").delete().eq("squad_id", s);
    await db.from("squads").delete().eq("id", s);
  }
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* already gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
