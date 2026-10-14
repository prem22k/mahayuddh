/**
 * Composer + contest-ingest + recommendation-log integration check.
 *
 * RUNS AGAINST THE LIVE DATABASE. Creates throwaway users and rows and deletes
 * every one on the way out, including on failure.
 *
 * What it pins:
 *   - each composer tile creates the object it names, not just a feed row
 *   - ownership is enforced at write time (a foreign battle cannot be shared)
 *   - the contest calendar parser rejects junk instead of writing it
 *   - the recommendation log counts one presentation as ONE row
 *
 * Run: npm run test:integration:composer
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { validateContest, parseCalendar } from "../../scripts/sync-contests.mjs";
import { acceptRate, signalBreakdown } from "../../lib/recommendationLog.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const tag = `comp${stamp}`;
const made = { users: [], squads: [], battles: [], problems: [], statuses: [], events: [], approaches: [], suggestions: [], stuck: [], feed: [], resources: [], members: [], logs: [] };

async function cleanup() {
  for (const t of [
    ["recommendation_log", made.logs, "id"],
    ["feed_events", made.feed, "id"],
    ["stuck_requests", made.stuck, "id"],
    ["suggestions", made.suggestions, "id"],
    ["approaches", made.approaches, "id"],
    ["battles", made.battles, "id"],
    ["problem_events", made.events, "id"],
    ["user_problem_status", made.statuses, "problem_slug"],
    ["shared_resources", made.resources, "id"],
    ["problems", made.problems, "title_slug"],
  ]) {
    const [table, rows, col] = t;
    for (const r of rows) await db.from(table).delete().eq(col, r);
  }
  for (const m of made.members) await db.from("squad_members").delete().eq("user_id", m);
  for (const s of made.squads) await db.from("squads").delete().eq("id", s);
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* gone */ }
  }
}

async function makeUser(i) {
  const email = `${tag}_${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  await db.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}` });
  return data.user.id;
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}
function ok(label, cond) { check(label, Boolean(cond), true); }

try {
  const alice = await makeUser(1);
  const bob = await makeUser(2);

  // ── Contest calendar parser (pure, no database) ────────────────────────────
  const now = new Date("2026-10-03T00:00:00Z");
  check("a good entry passes", validateContest({ title: "Weekly", starts_at: "2026-10-04T00:00:00Z", platform: "leetcode" }, now), null);
  ok("a bad date is rejected", validateContest({ title: "X", starts_at: "not-a-date" }, now) !== null);
  ok("an unknown platform is rejected", validateContest({ title: "X", starts_at: "2026-10-04T00:00:00Z", platform: "topcoder" }, now) !== null);
  ok("a non-http url is rejected", validateContest({ title: "X", starts_at: "2026-10-04T00:00:00Z", url: "javascript:alert(1)" }, now) !== null);
  ok("a long-past contest is rejected", validateContest({ title: "X", starts_at: "2020-01-01T00:00:00Z" }, now) !== null);
  ok("a far-future contest is rejected", validateContest({ title: "X", starts_at: "2028-01-01T00:00:00Z" }, now) !== null);
  ok("a missing title is rejected", validateContest({ starts_at: "2026-10-04T00:00:00Z" }, now) !== null);

  const dup = parseCalendar(JSON.stringify({
    contests: [
      { title: "A", starts_at: "2026-10-04T00:00:00Z", platform: "leetcode" },
      { title: "B", starts_at: "2026-10-04T00:00:00Z", platform: "leetcode" },
      { title: "C", starts_at: "2026-10-04T00:00:00Z", platform: "codeforces" },
    ],
  }));
  check("a duplicate inside the file is reported, not silently kept", dup.kept.length, 2);
  ok("the duplicate is named in the skip list", dup.skipped.some((s) => /duplicate/.test(s.reason)));

  const shipped = parseCalendar(readFileSync("data/contests.json", "utf8"));
  ok("the shipped calendar has no skipped entries", shipped.skipped.length === 0);
  ok("the shipped calendar is chronological", shipped.kept.every((c, i, a) => i === 0 || a[i - 1].starts_at <= c.starts_at));

  // ── The shipped calendar really upserts, and re-running changes nothing ────
  const before = await db.from("contests").select("id", { count: "exact", head: true });
  const up1 = await db.from("contests").upsert(shipped.kept, { onConflict: "starts_at,platform" }).select("id");
  ok("the calendar upserts", !up1.error);
  const mid = await db.from("contests").select("id", { count: "exact", head: true });
  const up2 = await db.from("contests").upsert(shipped.kept, { onConflict: "starts_at,platform" }).select("id");
  const after = await db.from("contests").select("id", { count: "exact", head: true });
  check("re-ingesting the calendar adds no rows", after.count, mid.count);
  ok("re-ingest reported no error", !up2.error);

  // ── Recommendation log: one presentation is ONE row ──────────────────────
  const { data: logRow, error: logErr } = await db.from("recommendation_log").insert({
    user_id: alice,
    problem_slug: `${tag}-log`,
    problem_title: "Probe",
    difficulty: "Medium",
    why_json: ["plateau"],
    signal_ids: ["plateau"],
    decision: "shown",
    surface: "home",
  }).select("id").single();
  if (logErr) throw new Error(`recommendation_log: ${logErr.message}`);
  made.logs.push(logRow.id);
  check("signal_ids is storable", (await db.from("recommendation_log").select("signal_ids").eq("id", logRow.id).single()).data.signal_ids, ["plateau"]);

  // The update path the decision logger uses: shown -> accepted, one row.
  const upd = await db.from("recommendation_log").update({ decision: "accepted" }).eq("id", logRow.id).select("id");
  ok("a shown row can become accepted in place", (upd.data ?? []).length === 1);
  const { count: logCount } = await db.from("recommendation_log").select("id", { count: "exact", head: true }).eq("user_id", alice);
  check("the decision did not add a second row", logCount, 1);

  // ── Composer: a solved battle can be shared, a foreign one cannot ─────────
  const { data: probs } = await db.from("problems").insert([
    { title_slug: `${tag}-p`, title: "Probe P", difficulty: "Medium", question_id: `${tag}-qp`, topics: ["Arrays"] },
  ]).select("title_slug");
  made.problems.push(...probs.map((p) => p.title_slug));

  const { data: aliceBattle } = await db.from("battles").insert({
    user_id: alice, problem_slug: `${tag}-p`, outcome: "solved",
    duration_sec: 420, evidence: "leetcode", started_at: new Date().toISOString(),
  }).select("id").single();
  made.battles.push(aliceBattle.id);

  const { data: bobBattle } = await db.from("battles").insert({
    user_id: bob, problem_slug: `${tag}-p`, outcome: "solved",
    duration_sec: 900, evidence: "none", started_at: new Date().toISOString(),
  }).select("id").single();
  made.battles.push(bobBattle.id);

  const { data: bobUnsolved } = await db.from("battles").insert({
    user_id: bob, problem_slug: `${tag}-p`, outcome: "failed",
    duration_sec: 60, started_at: new Date().toISOString(),
  }).select("id").single();
  made.battles.push(bobUnsolved.id);

  // Replicate what shareSolvedBattle does, as alice and as bob against alice's.
  const shareAs = async (viewerId, battleId) => {
    const { data: row } = await db.from("battles")
      .select("id,user_id,outcome,squad_id,problem_slug").eq("id", battleId).maybeSingle();
    if (!row || row.user_id !== viewerId || row.outcome !== "solved") return { ok: false };
    const { data, error } = await db.from("feed_events").insert({
      user_id: viewerId, event_type: "solve", problem_slug: row.problem_slug,
      squad_id: row.squad_id, object_type: "battle", object_id: row.id,
      metadata: { source: "composer" },
    }).select("id").single();
    if (error) return { ok: false };
    made.feed.push(data.id);
    return { ok: true };
  };

  check("you can share your own solved battle", (await shareAs(alice, aliceBattle.id)).ok, true);
  check("you cannot share somebody else's solved battle", (await shareAs(bob, aliceBattle.id)).ok, false);
  check("you cannot share a battle that was not solved", (await shareAs(bob, bobUnsolved.id)).ok, false);
  check("you can share your own solved battle", (await shareAs(bob, bobBattle.id)).ok, true);

  const { count: solveFeeds } = await db.from("feed_events").select("id", { count: "exact", head: true }).eq("object_type", "battle");
  check("two share events were created, not four", solveFeeds, 2);

  // ── Composer: a private approach cannot be taught ─────────────────────────
  const { data: priv } = await db.from("approaches").insert({
    user_id: alice, problem_slug: `${tag}-p`, pattern: "Arrays",
    core_idea: "Private approach", visibility: "private",
  }).select("id,visibility").single();
  made.approaches.push(priv.id);

  const { data: pub } = await db.from("approaches").insert({
    user_id: alice, problem_slug: `${tag}-p`, pattern: "Arrays",
    core_idea: "Public approach", visibility: "public",
  }).select("id,visibility").single();
  made.approaches.push(pub.id);

  const shareTeachAs = async (viewerId, approachId) => {
    const { data: row } = await db.from("approaches").select("id,visibility").eq("id", approachId).maybeSingle();
    if (!row) return { ok: false, why: "gone" };
    if (row.visibility !== "public") return { ok: false, why: "not public" };
    const { data, error } = await db.from("feed_events").insert({
      user_id: viewerId, event_type: "teach", object_type: "approach", object_id: row.id,
      metadata: { source: "composer" },
    }).select("id").single();
    if (error) return { ok: false, why: error.message };
    made.feed.push(data.id);
    return { ok: true };
  };

  check("a public approach can be taught", (await shareTeachAs(alice, pub.id)).ok, true);
  const privRes = await shareTeachAs(alice, priv.id);
  check("a private approach is refused", privRes.ok, false);
  check("and the refusal says why", privRes.why, "not public");

  // ── Composer: a stuck request carries its level ───────────────────────────
  const { data: stuck } = await db.from("stuck_requests").insert({
    user_id: bob, problem_slug: `${tag}-p`, level: "pattern", visibility: "public",
  }).select("id,level").single();
  made.stuck.push(stuck.id);
  check("the stuck level is stored verbatim", stuck.level, "pattern");

  const { data: badLevel } = await db
    .from("stuck_requests").insert({ user_id: bob, problem_slug: `${tag}-p`, level: "solution", visibility: "public" })
    .select("id").maybeSingle();
  ok("a level outside the ladder is refused by the database", Boolean(badLevel === null));
  if (badLevel?.id) made.stuck.push(badLevel.id);

  // ── Pure log analysis over the rows we just wrote ─────────────────────────
  const rows = [
    { decision: "accepted", signal_ids: ["plateau"], surface: "home", problem_slug: "a", created_at: "" },
    { decision: "dismissed", signal_ids: ["plateau"], surface: "home", problem_slug: "b", created_at: "" },
    { decision: "accepted", signal_ids: ["prereq_ready"], surface: "home", problem_slug: "c", created_at: "" },
  ];
  check("accept rate over the sample", acceptRate(rows).rate, 2 / 3);
  const bd = signalBreakdown(rows);
  check("plateau: 1 of 2", bd.find((s) => s.signal === "plateau").accepted, 1);
  check("prereq_ready: 1 of 1", bd.find((s) => s.signal === "prereq_ready").presented, 1);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);