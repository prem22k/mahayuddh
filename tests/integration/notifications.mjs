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
 *   - the goal nudge cannot stack, which is §37's low-noise default
 *   - contest reminders are idempotent so the cron can re-run them
 *   - leaderboard segments actually segment, and 'rising' is the default for a
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
const made = { users: [], squads: [], suggestions: [], goals: [], problems: [], events: [], notifications: [], contests: [], members: [] };

async function cleanup() {
  for (const n of made.notifications) await db.from("notifications").delete().eq("id", n);
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

  // One recent solve for bob, none for alice: 'rising' must show bob only.
  const { data: ev } = await db.from("problem_events").insert([
    { user_id: bob, problem_slug: `${tag}-r1`, kind: "solved", duration_sec: 900, metadata: {} },
  ]).select("id");
  made.events.push(...ev.map((e) => e.id));

  const { data: rising, error: rErr } = await db.rpc("global_leaderboard", {
    p_segment: "rising", p_pattern: null, p_limit: 25, p_offset: 0,
  });
  if (rErr) throw new Error(`global_leaderboard rising: ${rErr.message}`);
  ok("'rising' includes somebody who solved in the last 30 days", (rising ?? []).some((r) => r.user_id === bob));
  check("'rising' excludes somebody with no recent activity", (rising ?? []).some((r) => r.user_id === alice), false);
  ok("every rising row states what it was ranked by", (rising ?? []).every((r) => typeof r.segment_label === "string" && r.segment_label.length > 0));

  // Getting SLOWER must not count as improved. This assertion was backwards
  // when the segment was first written: the SQL selected `last >= first` and
  // the test asserted that the slower person belonged in "most improved", so
  // the bug was pinned by its own test. Fixed in 20261003000020.
  // Separate statements with a real gap. One statement gives both rows the same
  // created_at, and same-timestamp pairs produce no claim by design.
  await timedEvent(bob, `${tag}-imp`, "solved", 300, -2);
  await timedEvent(bob, `${tag}-imp`, "revisited", 900, -1);

  const { data: notImproved } = await db.rpc("global_leaderboard", {
    p_segment: "improved", p_pattern: null, p_limit: 25, p_offset: 0,
  });
  check("getting slower is NOT counted as improved", (notImproved ?? []).some((r) => r.user_id === bob), false);

  // Getting faster, twice, on two different problems -> two real gains.
  await timedEvent(alice, `${tag}-f1`, "solved", 900, -4);
  await timedEvent(alice, `${tag}-f1`, "revisited", 200, -3);
  await timedEvent(alice, `${tag}-f2`, "solved", 800, -2);
  await timedEvent(alice, `${tag}-f2`, "revisited", 150, -1);

  const { data: improved } = await db.rpc("global_leaderboard", {
    p_segment: "improved", p_pattern: null, p_limit: 25, p_offset: 0,
  });
  ok("getting faster twice IS counted as improved", (improved ?? []).some((r) => r.user_id === alice));
  const aliceRow = (improved ?? []).find((r) => r.user_id === alice);
  check("the improved count is the number of problems, not the number of solves", aliceRow?.segment_value, 2);
  // The label and the predicate must agree. If the label ever says "got faster"
  // while the predicate selects non-improvement, that is a one-line regression.
  ok("the row states that these problems got faster", /got faster/.test(aliceRow?.segment_label ?? ""));

  // Equal times are not an improvement.
  await timedEvent(bob, `${tag}-same`, "solved", 400, -2);
  await timedEvent(bob, `${tag}-same`, "revisited", 400, -1);
  const { data: improved3 } = await db.rpc("global_leaderboard", {
    p_segment: "improved", p_pattern: null, p_limit: 25, p_offset: 0,
  });
  check("identical times are not an improvement", (improved3 ?? []).find((r) => r.user_id === bob)?.segment_value ?? 0, 0);

  // One statement means one timestamp for both rows, so there is no order to
  // recover and the segment must decline to claim an improvement. This is the
  // case the old id tiebreak got wrong by coin flip.
  const { data: batch } = await db.from("problem_events").insert([
    { user_id: alice, problem_slug: `${tag}-batch`, kind: "solved", duration_sec: 900, metadata: {} },
    { user_id: alice, problem_slug: `${tag}-batch`, kind: "revisited", duration_sec: 100, metadata: {} },
  ]).select("id");
  made.events.push(...(batch ?? []).map((e) => e.id));
  const { data: improvedBatch } = await db.rpc("global_leaderboard", {
    p_segment: "improved", p_pattern: null, p_limit: 25, p_offset: 0,
  });
  check(
    "two solves sharing one timestamp make no improvement claim",
    (improvedBatch ?? []).find((r) => r.user_id === alice)?.segment_value ?? 0,
    2
  );

  // One timed solve cannot describe a change.
  await db.from("problem_events").insert([
    { user_id: bob, problem_slug: `${tag}-solo`, kind: "solved", duration_sec: 100, metadata: {} },
  ]).select("id").then(({ data }) => made.events.push(...(data ?? []).map((e) => e.id)));
  const { data: improved4 } = await db.rpc("global_leaderboard", {
    p_segment: "improved", p_pattern: null, p_limit: 25, p_offset: 0,
  });
  check("a single timed solve is not an improvement", (improved4 ?? []).find((r) => r.user_id === bob)?.segment_value ?? 0, 0);

  // ── §34: a beginner lands on 'rising', not the lifetime board ─────────────
  const { data: beginnerDefault } = await db.rpc("default_leaderboard_segment", { p_user: bob });
  check("a beginner's default segment is 'rising'", beginnerDefault, "rising");

  await db.from("profiles").update({ total_easy: 400, total_medium: 150 }).eq("id", alice);
  const { data: veteranDefault } = await db.rpc("default_leaderboard_segment", { p_user: alice });
  check("somebody with 550 lifetime solves gets the lifetime board", veteranDefault, "most_solved");

  // Pagination: a limit of 1 must not return the whole table.
  const { data: page1 } = await db.rpc("global_leaderboard", {
    p_segment: "rising", p_pattern: null, p_limit: 1, p_offset: 0,
  });
  const { data: page2 } = await db.rpc("global_leaderboard", {
    p_segment: "rising", p_pattern: null, p_limit: 1, p_offset: 1,
  });
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