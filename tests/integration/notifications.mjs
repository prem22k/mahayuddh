/**
 * Step 23 integration check — RUNS AGAINST THE LIVE DATABASE.
 *
 * Notifications, contests and leaderboard segments. Creates throwaway users and
 * rows in the linked Supabase project and deletes every one on the way out,
 * including on failure.
 *
 * What it pins:
 *   - a challenge insert produces exactly one notification (the §37 good case)
 *   - completing a challenge notifies the sender, not the recipient
 *   - a solved battle completing a challenge notifies the sender exactly once
 *   - the goal nudge cannot stack, which is §37's low-noise default
 *   - contest reminders are idempotent so the cron can re-run them
 *   - the global leaderboard ranks what it says (30-day solves, most improved), for a
 *     beginner rather than a lifetime 2,000-solve ranking (§34)
 *
 * Run: npm run test:integration:notify
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const tag = `note${stamp}`;
const made = { users: [], squads: [], suggestions: [], goals: [], problems: [], events: [], notifications: [], contests: [], members: [], battles: [], feed: [] };

async function cleanup() {
  for (const n of made.notifications) await db.from("notifications").delete().eq("id", n);
  for (const f of made.feed) await db.from("feed_events").delete().eq("object_id", f);
  for (const b of made.battles) await db.from("battles").delete().eq("id", b);
  for (const s of made.suggestions) await db.from("suggestions").delete().eq("id", s);
  for (const g of made.goals) await db.from("squad_goals").delete().eq("id", g);
  for (const e of made.events) await db.from("problem_events").delete().eq("id", e);
  for (const m of made.members) await db.from("squad_members").delete().eq("user_id", m);
  for (const s of made.squads) await db.from("squads").delete().eq("id", s);
  for (const p of made.problems) await db.from("problems").delete().eq("title_slug", p);
  for (const c of made.contests) await db.from("contests").delete().eq("id", c);
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* gone */ }
  }
}

async function makeUser(i, over = {}) {
  const email = `${tag}_${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  await db.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}`, ...over });
  return data.user.id;
}

async function makeSquad(owner, i) {
  const { data, error } = await db.from("squads")
    .insert({ name: `note-${tag}-${i}`, invite_code: `${tag}-s${i}`, created_by: owner })
    .select("id").single();
  if (error) throw new Error(`squad: ${error.message}`);
  made.squads.push(data.id);
  return data.id;
}

/** Insert one event with an explicit created_at, offset by N seconds. */
async function timedEvent(userId, slug, kind, durationSec, offsetSec) {
  const { data, error } = await db.from("problem_events").insert({
    user_id: userId, problem_slug: slug, kind,
    duration_sec: durationSec, metadata: {},
    created_at: new Date(Date.now() + offsetSec * 1000).toISOString(),
  }).select("id").single();
  if (error) throw new Error(`event ${slug}: ${error.message}`);
  made.events.push(data.id);
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}
function ok(label, cond) { check(label, Boolean(cond), true); }

async function notificationsFor(userId, kind) {
  const { data } = await db.from("notifications")
    .select("id,kind,title,body,deep_link,actor_id,dedupe_key,read_at")
    .eq("user_id", userId).eq("kind", kind);
  return (data ?? []).map((n) => ({ ...n, id: String(n.id) }));
}

async function clearNotifications(userId) {
  await db.from("notifications").delete().eq("user_id", userId);
}

// Global board through the one leaderboard function both tabs use.
const board = (metric, window, limit = 25, offset = 0) =>
  db.rpc("leaderboard", {
    p_scope: "global", p_metric: metric, p_window: window, p_pattern: null,
    p_linked_only: false, p_only_user: null, p_limit: limit, p_offset: offset,
  });

try {
  const alice = await makeUser(1);
  const bob = await makeUser(2);

  // ── A challenge produces one notification for the recipient (§37) ──────────
  const { data: sug, error: sugErr } = await db.from("suggestions").insert({
    from_user: alice, to_user: bob, problem_slug: `${tag}-x`,
    problem_title: "Probe Problem", difficulty: "Medium", sender_time_sec: 600,
  }).select("id").single();
  if (sugErr) throw new Error(`suggestion: ${sugErr.message}`);
  made.suggestions.push(sug.id);

  const bobNotes = await notificationsFor(bob, "challenge");
  check("a challenge notifies the recipient exactly once", bobNotes.length, 1);
  check("the notification deep-links to the challenge", bobNotes[0]?.deep_link, `/c/${sug.id}`);
  check("the notification names who challenged", bobNotes[0]?.actor_id, alice);
  ok("the title is action-oriented", (bobNotes[0]?.title ?? "").toLowerCase().includes("challeng"));
  if (bobNotes[0]) made.notifications.push(bobNotes[0].id);

  check("the sender is not notified about their own challenge", (await notificationsFor(alice, "challenge")).length, 0);

  // ── Completing it notifies the sender, and only once ──────────────────────
  const { error: compErr } = await db.from("suggestions")
    .update({ status: "completed" }).eq("id", sug.id);
  if (compErr) throw new Error(`complete: ${compErr.message}`);

  const aliceNotes = await notificationsFor(alice, "challenge_completed");
  check("completing a challenge notifies the sender once", aliceNotes.length, 1);
  ok("the sender's notice is actionable", (aliceNotes[0]?.deep_link ?? "").startsWith("/c/"));
  if (aliceNotes[0]) made.notifications.push(aliceNotes[0].id);
  check("the recipient gets no completion notice", (await notificationsFor(bob, "challenge_completed")).length, 0);

  // Re-saving the same status must not notify again.
  await db.from("suggestions").update({ status: "completed", note: "again" }).eq("id", sug.id);
  check("re-saving the same status does not re-notify", (await notificationsFor(alice, "challenge_completed")).length, 1);

  // ── A solved battle completes the challenge: one notice, one feed event ────
  // The trigger is the only writer of the sender's notice. A second insert from
  // the client or the LeetCode sync used to double it up.
  await clearNotifications(alice);
  const { data: sug2, error: sug2Err } = await db.from("suggestions").insert({
    from_user: alice, to_user: bob, problem_slug: `${tag}-y`,
    problem_title: "Probe Battle Problem", difficulty: "Medium", sender_time_sec: 600,
  }).select("id").single();
  if (sug2Err) throw new Error(`suggestion 2: ${sug2Err.message}`);
  made.suggestions.push(sug2.id);
  made.feed.push(sug2.id);

  const { data: battle, error: battleErr } = await db.from("battles")
    .insert({ user_id: bob, problem_slug: `${tag}-y`, challenge_id: sug2.id })
    .select("id").single();
  if (battleErr) throw new Error(`battle: ${battleErr.message}`);
  made.battles.push(battle.id);
  const { error: solveErr } = await db.from("battles")
    .update({ outcome: "solved", ended_at: new Date().toISOString(), duration_sec: 420 })
    .eq("id", battle.id);
  if (solveErr) throw new Error(`solve battle: ${solveErr.message}`);

  const { data: sug2Row } = await db.from("suggestions").select("status").eq("id", sug2.id).single();
  check("a solved battle completes its challenge", sug2Row?.status, "completed");
  const battleNotes = await notificationsFor(alice, "challenge_completed");
  check("completing via a battle notifies the sender exactly once", battleNotes.length, 1);
  ok("the notice names the solver by username", (battleNotes[0]?.body ?? "").includes(`${tag}_2`));
  for (const n of battleNotes) made.notifications.push(n.id);
  const { data: completeEvents } = await db.from("feed_events")
    .select("id").eq("object_id", sug2.id).eq("event_type", "complete");
  check("completing via a battle logs one 'complete' feed event", (completeEvents ?? []).length, 1);

  // ── Goal nudge cannot stack (§37 low-noise default) ────────────────────────
  await clearNotifications(bob);
  const squad = await makeSquad(alice, 1);
  for (const uid of [alice, bob]) {
    await db.from("squad_members").insert({ squad_id: squad, user_id: uid });
    made.members.push(uid);
  }

  const { data: goal, error: goalErr } = await db.from("squad_goals").insert({
    squad_id: squad, title: "Probe goal", target_count: 4,
    pattern: "Arrays", created_by: alice,
  }).select("id").single();
  if (goalErr) throw new Error(`goal: ${goalErr.message}`);
  made.goals.push(goal.id);

  // Inserting the goal does not notify (it is nowhere near done), but re-saving
  // it repeatedly must not stack notices either way.
  await db.from("squad_goals").update({ title: "Probe goal v2" }).eq("id", goal.id);
  await db.from("squad_goals").update({ title: "Probe goal v3" }).eq("id", goal.id);
  const goalNotes = await notificationsFor(bob, "goal");
  check("repeated goal saves produce at most one open nudge", goalNotes.length <= 1, true);
  for (const n of goalNotes) made.notifications.push(n.id);

  // ── Contests (§36): reminder is idempotent by dedupe key ──────────────────
  const starts = new Date(Date.now() + 20 * 3600_000).toISOString();
  const { data: contest, error: cErr } = await db.from("contests").insert({
    title: "Probe Weekly", starts_at: starts, url: "https://leetcode.com/contest/",
  }).select("id").single();
  if (cErr) throw new Error(`contest: ${cErr.message}`);
  made.contests.push(contest.id);

  await clearNotifications(bob);
  const first = await db.rpc("notify_contest_reminders", { p_within: "24:00:00" });
  const afterFirst = await notificationsFor(bob, "contest");
  ok("a contest 20h out produces a reminder", afterFirst.length >= 1);
  for (const n of afterFirst) made.notifications.push(n.id);

  const second = await db.rpc("notify_contest_reminders", { p_within: "24:00:00" });
  const afterSecond = await notificationsFor(bob, "contest");
  check("running the reminder again sends nothing new", afterSecond.length, afterFirst.length);

  // A contest far in the future must not fire.
  const { data: far, error: farErr } = await db.from("contests").insert({
    title: "Probe Far", starts_at: new Date(Date.now() + 72 * 3600_000).toISOString(),
  }).select("id").single();
  if (farErr) throw new Error(`contest far: ${farErr.message}`);
  made.contests.push(far.id);
  await db.rpc("notify_contest_reminders", { p_within: "24:00:00" });
  const farNotes = (await notificationsFor(bob, "contest")).filter((n) => (n.body ?? "").includes("Probe Far"));
  check("a contest 72h out produces no reminder", farNotes.length, 0);

  // Duplicate ingest of the same start time must be refused, so a re-run of the
  // calendar script cannot double-notify.
  const { error: dupErr } = await db.from("contests").insert({
    title: "Probe Weekly again", starts_at: starts,
  });
  ok("re-ingesting the same contest start time is refused", Boolean(dupErr));

  // ── Leaderboard segments (§34) ────────────────────────────────────────────
  await clearNotifications(bob);

  // One recent solve for bob, none for alice: the 30-day Solves board shows bob only.
  const { data: ev } = await db.from("problem_events").insert([
    { user_id: bob, problem_slug: `${tag}-r1`, kind: "solved", duration_sec: 900, metadata: {} },
  ]).select("id");
  made.events.push(...ev.map((e) => e.id));

  const { data: rising, error: rErr } = await board("solves", "month", 25, 0);
  if (rErr) throw new Error(`leaderboard solves: ${rErr.message}`);
  ok("the 30-day board includes somebody who solved in the last 30 days", (rising ?? []).some((r) => r.user_id === bob));
  check("the 30-day board excludes somebody with no recent activity", (rising ?? []).some((r) => r.user_id === alice), false);
  ok("every row carries its rank and value", (rising ?? []).every((r) => Number.isInteger(r.rank) && Number.isInteger(r.value)));

  // Getting SLOWER must not count as improved. This assertion was backwards
  // when the segment was first written: the SQL selected `last >= first` and
  // the test asserted that the slower person belonged in "most improved", so
  // the bug was pinned by its own test. Fixed in 20261003000020.
  // Separate statements with a real gap. One statement gives both rows the same
  // created_at, and same-timestamp pairs produce no claim by design.
  await timedEvent(bob, `${tag}-imp`, "solved", 300, -2);
  await timedEvent(bob, `${tag}-imp`, "revisited", 900, -1);

  const { data: notImproved } = await board("improved", "month", 25, 0);
  check("getting slower is NOT counted as improved", (notImproved ?? []).some((r) => r.user_id === bob), false);

  // Getting faster, twice, on two different problems -> two real gains.
  await timedEvent(alice, `${tag}-f1`, "solved", 900, -4);
  await timedEvent(alice, `${tag}-f1`, "revisited", 200, -3);
  await timedEvent(alice, `${tag}-f2`, "solved", 800, -2);
  await timedEvent(alice, `${tag}-f2`, "revisited", 150, -1);

  const { data: improved } = await board("improved", "month", 25, 0);
  ok("getting faster twice IS counted as improved", (improved ?? []).some((r) => r.user_id === alice));
  const aliceRow = (improved ?? []).find((r) => r.user_id === alice);
  check("the improved count is the number of problems, not the number of solves", aliceRow?.value, 2);
  // The row's wording ("problems got faster") lives in lib/leaderboardLabels.ts,
  // covered by the smoke tests.

  // Equal times are not an improvement.
  await timedEvent(bob, `${tag}-same`, "solved", 400, -2);
  await timedEvent(bob, `${tag}-same`, "revisited", 400, -1);
  const { data: improved3 } = await board("improved", "month", 25, 0);
  check("identical times are not an improvement", (improved3 ?? []).find((r) => r.user_id === bob)?.value ?? 0, 0);

  // One statement means one timestamp for both rows, so there is no order to
  // recover and the segment must decline to claim an improvement. This is the
  // case the old id tiebreak got wrong by coin flip.
  const { data: batch } = await db.from("problem_events").insert([
    { user_id: alice, problem_slug: `${tag}-batch`, kind: "solved", duration_sec: 900, metadata: {} },
    { user_id: alice, problem_slug: `${tag}-batch`, kind: "revisited", duration_sec: 100, metadata: {} },
  ]).select("id");
  made.events.push(...(batch ?? []).map((e) => e.id));
  const { data: improvedBatch } = await board("improved", "month", 25, 0);
  check(
    "two solves sharing one timestamp make no improvement claim",
    (improvedBatch ?? []).find((r) => r.user_id === alice)?.value ?? 0,
    2
  );

  // One timed solve cannot describe a change.
  await db.from("problem_events").insert([
    { user_id: bob, problem_slug: `${tag}-solo`, kind: "solved", duration_sec: 100, metadata: {} },
  ]).select("id").then(({ data }) => made.events.push(...(data ?? []).map((e) => e.id)));
  const { data: improved4 } = await board("improved", "month", 25, 0);
  check("a single timed solve is not an improvement", (improved4 ?? []).find((r) => r.user_id === bob)?.value ?? 0, 0);

  // Pagination: a limit of 1 must not return the whole table.
  const { data: page1 } = await board("solves", "month", 1, 0);
  const { data: page2 } = await board("solves", "month", 1, 1);
  check("limit is respected", (page1 ?? []).length, 1);
  ok("a second page returns a different row", (page2 ?? [])[0]?.user_id !== (page1 ?? [])[0]?.user_id || (page1 ?? []).length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);