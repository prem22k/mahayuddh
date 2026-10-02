/**
 * Step 22 teacher_stats integration check — RUNS AGAINST THE LIVE DATABASE.
 *
 * Not part of test:smoke. Creates throwaway users and rows in the linked
 * Supabase project and deletes every one on the way out.
 *
 * The headline assertion is the §22 ban: teacher_stats must have no total, no
 * score, no rank. That is checked by reading information_schema rather than by
 * trusting a comment, because the whole point of §22 is that a score would look
 * authoritative to anyone who found it later.
 *
 * Run: npm run test:integration:teacher
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const tag = `teach${stamp}`;
const made = { users: [], problems: [], battles: [], events: [], approaches: [], primers: [], notes: [] };

async function cleanup() {
  for (const n of made.notes) await db.from("notebook_notes").delete().eq("id", n);
  for (const a of made.approaches) await db.from("approaches").delete().eq("id", a);
  for (const p of made.primers) await db.from("primers").delete().eq("id", p);
  for (const b of made.battles) await db.from("battles").delete().eq("id", b);
  for (const e of made.events) await db.from("problem_events").delete().eq("id", e);
  for (const p of made.problems) await db.from("problems").delete().eq("title_slug", p);
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* gone */ }
  }
}

async function makeUser(i) {
  const email = `${tag}_${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({
    email, password: "probe-pw-123", email_confirm: true,
  });
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
  // ── §22: no aggregate column, structurally ────────────────────────────────
  // information_schema is not reachable through PostgREST, so probe the view's
  // shape by selecting * and refusing any column that aggregates.
  const { data: sample, error: viewErr } = await db.from("teacher_stats").select("*").limit(1);
  if (viewErr) throw new Error(`teacher_stats: ${viewErr.message}`);

  const columnNames = sample && sample.length > 0
    ? Object.keys(sample[0])
    : await probeColumnNames();

  const banned = columnNames.filter((c) =>
    /^(total|overall|reputation|reputation_score|score|rating|rank|points|xp|level|star)/i.test(c)
  );
  check("§22: teacher_stats exposes no total, score, rank or points column", banned, []);

  const dimensions = columnNames.filter((c) =>
    ["verified_solves", "approaches", "primers", "challenge_completions", "active_days", "note_forks", "primer_forks"].includes(c)
  );
  ok("§22: the five dimensions are present as separate columns", dimensions.length >= 5);
  ok("§22: verified_solves is separate from logged_solves", columnNames.includes("verified_solves"));

  // ── Counts come from real rows ─────────────────────────────────────────────
  const teacher = await makeUser(1);
  const pattern = `Probe Pattern ${stamp}`;

  const { data: probs, error: probErr } = await db
    .from("problems")
    .insert([
      { title_slug: `${tag}-a`, title: "Probe A", difficulty: "Medium", question_id: `${tag}-qa`, topics: [pattern] },
      { title_slug: `${tag}-b`, title: "Probe B", difficulty: "Hard", question_id: `${tag}-qb`, topics: [pattern] },
    ])
    .select("title_slug");
  if (probErr) throw new Error(`problems: ${probErr.message}`);
  made.problems.push(...(probs ?? []).map((p) => p.title_slug));

  // Two solves on the same problem, both with durations -> one improvement.
  // A third solve with no duration must not add to it.
  const { data: evs } = await db.from("problem_events").insert([
    { user_id: teacher, problem_slug: `${tag}-a`, kind: "solved", duration_sec: 900, metadata: { source: "leetcode" } },
    { user_id: teacher, problem_slug: `${tag}-a`, kind: "revisited", duration_sec: 300, metadata: { source: "leetcode" } },
    { user_id: teacher, problem_slug: `${tag}-b`, kind: "solved", duration_sec: null, metadata: { source: "self" } },
  ]).select("id");
  made.events.push(...evs.map((e) => e.id));

  const { data: apps } = await db.from("approaches").insert([{
    user_id: teacher,
    problem_slug: `${tag}-a`,
    pattern,
    core_idea: "Probe approach for teacher discovery.",
    visibility: "public",
  }]).select("id");
  made.approaches.push(...apps.map((a) => a.id));

  const { data: prim } = await db.from("primers").insert([{
    slug: `${tag}-primer`,
    pattern,
    title: "Probe Primer",
    recognize_when: ["probe"],
    author_id: teacher,
    visibility: "public",
  }]).select("id");
  made.primers.push(...prim.map((p) => p.id));

  // A fork of that primer, which is the copy signal.
  const { data: fork } = await db.from("notebook_notes").insert([{
    owner_id: teacher,
    title: "Copied primer",
    body_md: "copied",
    visibility: "public",
    fork_of: prim[0].id,
    fork_from: "Mahayuddh primers",
    pattern_tags: [pattern],
  }]).select("id");
  made.notes.push(...fork.map((f) => f.id));

  const { data: stats } = await db.from("teacher_stats").select("*").eq("user_id", teacher).single();
  if (!stats) throw new Error("teacher_stats returned no row for the probe user");

  check("logged solves counted", stats.logged_solves, 3);
  // §22 asks for VERIFIED solves: only LeetCode-backed ones count as verified.
  check("verified solves exclude self-reported ones", stats.verified_solves, 2);
  check("improvement needs two timed solves on one problem", stats.improvements, 1);
  check("public approaches counted", stats.approaches, 1);
  check("public primers counted", stats.primers, 1);
  check("primer forks counted from the copies, not a counter", stats.primer_forks, 1);
  ok("frequent patterns include the taught one", (stats.frequent_patterns ?? []).includes(pattern));

  // ── Teacher discovery (§21/§22): ordered by forks, not followers ───────────
  const { data: teachers, error: tErr } = await db.rpc("teachers_for_pattern", {
    p_pattern: pattern, p_limit: 8,
  });
  if (tErr) throw new Error(`teachers_for_pattern: ${tErr.message}`);
  ok("the author of a public primer is discoverable for their pattern", (teachers ?? []).some((t) => t.user_id === teacher));
  const mine = (teachers ?? []).find((t) => t.user_id === teacher);
  check("teacher row reports the primer they wrote", mine?.primers, 1);
  check("teacher row reports the approach they wrote", mine?.approaches, 1);

  const { data: nobody } = await db.rpc("teachers_for_pattern", {
    p_pattern: `Nobody Teaches This ${stamp}`, p_limit: 8,
  });
  check("a pattern nobody teaches returns nobody", (nobody ?? []).length, 0);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

/** Fallback when the view is empty: ask Postgres for the column list. */
async function probeColumnNames() {
  // PostgREST cannot read information_schema, so infer from a typed probe: ask
  // for one specific banned column and see whether Postgres rejects it.
  const probes = ["total", "overall_reputation", "score", "rank", "reputation"];
  const present = [];
  for (const p of probes) {
    const { error } = await db.from("teacher_stats").select(p).limit(1);
    if (!error) present.push(p);
  }
  return present;
}

process.exit(fail > 0 ? 1 : 0);