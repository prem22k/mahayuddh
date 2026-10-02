/**
 * Wall milestone integration check — RUNS AGAINST THE LIVE DATABASE.
 *
 * Not part of `npm run test:smoke`, which is pure and hermetic. This one needs
 * to exercise real triggers, so it creates throwaway auth users and rows in the
 * linked Supabase project and deletes every one of them on the way out
 * (including on failure). Do not point it at a database you care about without
 * reading the cleanup block.
 *
 * It exists because of a real bug. The 50/100-solve milestones counted rows in
 * problem_events but fired from a trigger on battles, and the app writes those
 * two rows as independent, unordered, fire-and-forget requests. Measured, the
 * milestone was permanently lost whenever the battle update won the race — and
 * a solve logged from the roadmap matrix, which produces no battles row at all,
 * could never reach the wall. See migration 20261003000010.
 *
 * Case 2 is the regression guard for that race. It reproduces the losing
 * ordering on purpose: 49 events, then the battle update, then the 50th event.
 *
 * Run: npm run test:integration:wall
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
const serviceKey = env.SUPABASE_SECRET_KEY;
if (!url || !serviceKey) throw new Error("missing supabase env");

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const tag = `wallprobe${stamp}`;
let created = { profiles: [], squads: [], battles: [], events: [] };

async function cleanup() {
  await db.from("squad_milestones").delete().eq("detail", `probe:${tag}`);
  for (const e of created.events) await db.from("problem_events").delete().eq("id", e);
  for (const b of created.battles) await db.from("battles").delete().eq("id", b);
  for (const s of created.squads) await db.from("squads").delete().eq("id", s);
  for (const p of created.profiles) await db.from("profiles").delete().eq("id", p);
}

async function makeProfile(i) {
  const email = `${tag}${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123" });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user.id;
  created.profiles.push(id);
  const { error: pErr } = await db.from("profiles").insert({ id, username: `${tag}_${i}` });
  if (pErr) throw new Error(`profile: ${pErr.message}`);
  return id;
}

async function makeSquad(owner, i) {
  const { data, error } = await db
    .from("squads")
    .insert({ name: `probe-${tag}-${i}`, invite_code: `${tag}-${i}`, created_by: owner })
    .select("id")
    .single();
  if (error) throw new Error(`squad: ${error.message}`);
  created.squads.push(data.id);
  await db.from("squad_members").insert({ squad_id: data.id, user_id: owner });
  return data.id;
}

/**
 * Battle rows, so the trigger has something to fire on.
 *
 * Inserted as in_progress on purpose. The trigger's WHEN clause requires
 * old.outcome is distinct from new.outcome, so a battle created already
 * 'solved' never fires it — and a probe that inserts solved battles proves
 * nothing at all.
 */
async function makeBattles(userId, squadId, count, outcome = "in_progress") {
  const rows = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    problem_slug: `${tag}-p${i}`,
    squad_id: squadId,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    duration_sec: 100,
    outcome,
  }));
  const { data, error } = await db.from("battles").insert(rows).select("id");
  if (error) throw new Error(`battles: ${error.message}`);
  created.battles.push(...data.map((d) => d.id));
  return data.map((d) => d.id);
}

async function makeEvents(userId, count, kind) {
  const rows = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    problem_slug: `${tag}-e${i}`,
    kind,
    battle_id: null,
    duration_sec: 100,
    metadata: { detail: `probe:${tag}` },
  }));
  const { data, error } = await db.from("problem_events").insert(rows).select("id");
  if (error) throw new Error(`events: ${error.message}`);
  created.events.push(...data.map((d) => d.id));
}

async function probeMilestones(squadId) {
  const { data, error } = await db
    .from("squad_milestones")
    .select("kind, title")
    .eq("squad_id", squadId)
    .order("kind");
  if (error) console.error("  probe select error:", error.message);
  return (data ?? []).map((m) => `${m.kind}:${m.title}`).sort();
}

/** What the trigger itself counts, straight from the database. */
async function countSolves(userId) {
  const { count } = await db
    .from("problem_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("kind", ["solved", "revisited"]);
  return count ?? 0;
}

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
  return ok;
}

try {
  const owner = await makeProfile(1);
  const squad = await makeSquad(owner, 1);

  // ── Case 1: event first, then battle update. The trigger sees the full count.
  await makeEvents(owner, 50, "solved");
  console.log(`  (solve events for the probe user: ${await countSolves(owner)})`);
  let ids = await makeBattles(owner, squad, 1);
  const { error: upErr } = await db.from("battles").update({ outcome: "solved" }).eq("id", ids[0]);
  if (upErr) console.error("  battle update error:", upErr.message);
  check(
    "50 solves: events before the battle update records the milestone",
    await probeMilestones(squad),
    ["first_member:Squad formed", "first_solve:First battle won", "milestone_solves:50 solves"]
  );

  // ── Case 2: the race that used to lose the milestone. Both writes are
  //    fire-and-forget, so the battle update can land first. Reproduce it
  //    exactly: 49 events, battle update, then the 50th event arrives.
  await db.from("squad_milestones").delete().eq("squad_id", squad).eq("kind", "milestone_solves");
  const dropped = created.events.pop();
  await db.from("problem_events").delete().eq("id", dropped);
  console.log(`  (after dropping one event: ${await countSolves(owner)} solves)`);
  ids = await makeBattles(owner, squad, 1);
  await db.from("battles").update({ outcome: "solved" }).eq("id", ids[0]);
  await makeEvents(owner, 1, "solved");
  console.log(`  (after the 50th event lands: ${await countSolves(owner)} solves)`);
  check(
    "50th solve: recorded even when the battle update won the race",
    await probeMilestones(squad),
    ["first_member:Squad formed", "first_solve:First battle won", "milestone_solves:50 solves"]
  );

  // ── Case 3: the 100-solve milestone has its own kind and must not collide.
  await makeEvents(owner, 50, "solved");
  console.log(`  (solve events for the probe user: ${await countSolves(owner)})`);
  ids = await makeBattles(owner, squad, 1);
  await db.from("battles").update({ outcome: "solved" }).eq("id", ids[0]);
  check(
    "100 solves: both kinds present, 100 does not overwrite 50",
    await probeMilestones(squad),
    ["first_member:Squad formed", "first_solve:First battle won", "milestone_solves:50 solves", "milestone_solves_100:100 solves"]
  );

  // ── Case 4: solves that never had a battle session. A solve logged from the
  //    roadmap matrix or a sheet batch writes a problem_events row and nothing
  //    else, so a battles-only trigger could never reward these at all.
  const owner2 = await makeProfile(2);
  const squad2 = await makeSquad(owner2, 2);
  await makeEvents(owner2, 50, "solved");
  console.log(`  (battleless solves in squad 2: ${await countSolves(owner2)})`);
  check(
    "50 solves with NO battle session still reaches the wall",
    await probeMilestones(squad2),
    ["first_member:Squad formed", "milestone_solves:50 solves"]
  );

  // ── Case 5: a non-solve event must not move the count.
  const owner3 = await makeProfile(3);
  const squad3 = await makeSquad(owner3, 3);
  await makeEvents(owner3, 60, "failed");
  console.log(`  (solve count for 60 failures: ${await countSolves(owner3)})`);
  check(
    "60 failures are not 50 solves",
    await probeMilestones(squad3),
    ["first_member:Squad formed"]
  );

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);