/**
 * Battle ends append history even when the client write is lost. RUNS AGAINST THE LIVE DB.
 *
 * Until 00045, problem_events for a battle end was written by the client in
 * NowSolvingBar, fire-and-forget with `.catch(()=>{})`, as a second independent
 * write after `endBattle`. A dropped insert — or a tab closed between the two
 * calls — left a solve in `battles` that never appeared in timelines, journeys,
 * recaps, the retention gate, or the recommendation engine. A solve the product
 * pretends never happened, in exactly the places a member goes to look.
 *
 * 00045 moved that write into a trigger. These checks prove the three properties
 * that make the move safe:
 *
 *   1. ending a battle through the API produces exactly one problem event with
 *      no client call at all;
 *   2. a client that ALSO logs (the normal path) does not create a second one;
 *   3. the solved-vs-revisited distinction the dock used to make is preserved.
 *
 * Run: BASE_URL=http://localhost:xxxx npm run test:integration:battles
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  console.error("BASE_URL is required (the battle API is exercised, not just the tables).");
  process.exitCode = 2;
}

const tag = `bt${Date.now()}`.slice(0, 12);
const made = { users: [], squads: [], battles: [] };
const PW = "probe-pw-123";

let passed = 0;
const failures = [];
async function check(label, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  ✓ ${label}\n`);
  } catch (e) {
    failures.push(`${label}: ${e.message}`);
    process.stdout.write(`  ✗ ${label}\n    ${e.message}\n`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function makeMember() {
  const email = `${tag}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  const username = `${tag}${Math.random().toString(36).slice(2, 5)}`.slice(0, 24);
  await db.from("profiles").insert({ id: data.user.id, username });

  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await c.auth.signInWithPassword({ email, password: PW });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  return { id: data.user.id, email, token: sess.session.access_token };
}

async function api(token, body) {
  const res = await fetch(`${BASE_URL}/api/battles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function cleanup() {
  for (const id of made.battles) {
    await db.from("problem_events").delete().not("battle_id", "is", null).eq("battle_id", id).then(() => {});
    await db.from("battles").delete().eq("id", id);
  }
  await db.from("problem_events").delete().in("user_id", made.users);
  for (const id of made.squads) {
    await db.from("squad_members").delete().eq("squad_id", id);
    await db.from("squads").delete().eq("id", id);
  }
  for (const id of made.users) {
    await db.from("profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function main() {
  if (!BASE_URL) return;
  console.log("Battle ends append history without the client\n");

  const member = await makeMember();
  const { data: prob } = await db.from("problems").select("title_slug").eq("paid_only", false).limit(1);
  const slug = prob[0].title_slug;

  console.log("the trigger writes what the client used to");

  let firstBattle = null;
  await check("ending a battle appends exactly one event, with no client call", async () => {
    const started = await api(member.token, { action: "start", problem_slug: slug });
    // The route answers 201 on create. What matters is that a battle came back.
    assert(started.body?.battle?.id, `start failed: ${started.status} ${JSON.stringify(started.body).slice(0, 120)}`);
    firstBattle = started.body.battle.id;
    made.battles.push(firstBattle);

    // The route's update is what fires the trigger. No logProblemEvent anywhere.
    const ended = await api(member.token, { action: "end", battle_id: firstBattle, outcome: "solved", duration_sec: 600 });
    assert(ended.body?.success === true, `end failed: ${ended.status} ${JSON.stringify(ended.body).slice(0,120)}`);

    const { data: rows } = await db.from("problem_events").select("kind, battle_id, user_id").eq("battle_id", firstBattle);
    assert(rows.length === 1, `expected 1 event, got ${rows.length}: ${JSON.stringify(rows)}`);
    assert(rows[0].kind === "solved", `first solve should be 'solved', got '${rows[0].kind}'`);
    assert(rows[0].user_id === member.id, "the event is not attributed to the battler");
  });

  await check("a client that also logs does not create a second event", async () => {
    // This is the normal path: NowSolvingBar calls endBattle AND logProblemEvent.
    // The unique index makes the second write impossible, and the client is
    // taught to treat 23505 as "already recorded" rather than as a failure.
    // Service role is used so the write itself is not the thing being tested —
    // only whether the row can exist twice.
    const { error } = await db.from("problem_events").insert({
      user_id: member.id, problem_slug: slug, kind: "solved", battle_id: firstBattle, duration_sec: 600,
      metadata: { source: "self" },
    });
    assert(error && error.code === "23505", `expected a unique-violation, got: ${error?.message ?? "no error"}`);

    const { data: rows } = await db.from("problem_events").select("id").eq("battle_id", firstBattle);
    assert(rows.length === 1, `a duplicate event exists: ${rows.length} rows for one battle`);
  });

  await check("a repeat solve for the same problem is a revisit", async () => {
    const started = await api(member.token, { action: "start", problem_slug: slug });
    assert(started.body?.battle?.id, `start failed: ${started.status}`);
    const id = started.body.battle.id;
    made.battles.push(id);
    const ended = await api(member.token, { action: "end", battle_id: id, outcome: "solved", duration_sec: 500 });
    assert(ended.body?.success === true, `end failed: ${ended.status} ${JSON.stringify(ended.body).slice(0,120)}`);

    const { data: rows } = await db.from("problem_events").select("kind").eq("battle_id", id);
    assert(rows.length === 1 && rows[0].kind === "revisited",
      `expected one 'revisited', got ${JSON.stringify(rows)}`);
  });

  await check("a failed battle appends a failed event", async () => {
    const { data: prob2 } = await db.from("problems").select("title_slug").eq("paid_only", false).limit(2);
    const other = prob2[1]?.title_slug ?? slug;
    const started = await api(member.token, { action: "start", problem_slug: other });
    assert(started.body?.battle?.id, `start failed: ${started.status}`);
    const id = started.body.battle.id;
    made.battles.push(id);
    const ended = await api(member.token, { action: "end", battle_id: id, outcome: "failed", duration_sec: 900 });
    assert(ended.body?.success === true, `end failed: ${ended.status} ${JSON.stringify(ended.body).slice(0,120)}`);

    const { data: rows } = await db.from("problem_events").select("kind").eq("battle_id", id);
    assert(rows.length === 1 && rows[0].kind === "failed",
      `expected one 'failed', got ${JSON.stringify(rows)}`);
  });

  await check("an abandoned battle appends nothing", async () => {
    const started = await api(member.token, { action: "start", problem_slug: slug });
    assert(started.body?.battle?.id, `start failed: ${started.status}`);
    const id = started.body.battle.id;
    made.battles.push(id);
    const ended = await api(member.token, { action: "end", battle_id: id, outcome: "abandoned", duration_sec: 60 });
    assert(ended.body?.success === true, `end failed: ${ended.status} ${JSON.stringify(ended.body).slice(0,120)}`);

    const { data: rows } = await db.from("problem_events").select("id").eq("battle_id", id);
    assert(rows.length === 0, `an abandoned battle left ${rows.length} event(s)`);
  });

  await check("a manual toggle without a battle still works", async () => {
    // Sheets/matrix checkboxes write battle_id NULL. The trigger and the
    // partial index do not apply to them, and must not interfere.
    const { data: prob3 } = await db.from("problems").select("title_slug").eq("paid_only", false).limit(3);
    const manual = prob3[2]?.title_slug ?? slug;
    const { error } = await db.from("problem_events").insert({
      user_id: member.id, problem_slug: manual, kind: "solved", battle_id: null,
      metadata: { source: "self" },
    });
    assert(!error, `manual toggle write failed: ${error?.message}`);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exitCode = 1; }
}

main()
  .catch((e) => { console.error(`\nharness error: ${e.message}`); process.exitCode = 1; })
  .finally(cleanup);
