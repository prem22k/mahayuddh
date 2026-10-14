/**
 * Step 26 Loop C integration check — RUNS AGAINST THE LIVE DATABASE.
 *
 * The claim being tested is "your primer helped N developers solve X", which is
 * a causal-sounding statement. It is only allowed to be made if the window and
 * the "actually solved" part are real, so that is what this pins:
 *
 *   - a fork increments the author's counter (trigger, not a client write)
 *   - a solve AFTER the fork on a starter problem counts as a completion
 *   - a solve BEFORE the fork does not
 *   - a solve more than 30 days after does not
 *   - a solve of an unrelated problem does not
 *   - deleting the copy decrements the counter
 *   - my_content_impact says "none solved the problem yet" rather than claiming
 *     an impact that did not happen
 *
 * Run: npm run test:integration:impact
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const tag = `imp${stamp}`;
const made = { users: [], primers: [], approaches: [], notes: [], events: [], problems: [] };

async function cleanup() {
  for (const n of made.notes) await db.from("notebook_notes").delete().eq("id", n);
  for (const a of made.approaches) await db.from("approaches").delete().eq("id", a);
  for (const p of made.primers) await db.from("primers").delete().eq("id", p);
  for (const e of made.events) await db.from("problem_events").delete().eq("id", e);
  for (const p of made.problems) await db.from("problems").delete().eq("title_slug", p);
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* gone */ }
  }
}

async function makeUser(i) {
  const email = `${tag}_${i}@example.com`;
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

async function forkOf(sourceId, sourceType, ownerId, createdAt) {
  const { data, error } = await db.from("notebook_notes").insert({
    owner_id: ownerId,
    title: `Copied ${tag}`,
    body_md: "copy",
    visibility: "private",
    fork_of: sourceId,
    fork_of_type: sourceType,
    created_at: createdAt,
  }).select("id").single();
  if (error) throw new Error(`fork: ${error.message}`);
  made.notes.push(data.id);
  return data.id;
}

async function solve(userId, slug, at) {
  const { data, error } = await db.from("problem_events").insert({
    user_id: userId, problem_slug: slug, kind: "solved", duration_sec: 600, metadata: {},
    created_at: at,
  }).select("id").single();
  if (error) throw new Error(`solve: ${error.message}`);
  made.events.push(data.id);
}

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

try {
  const author = await makeUser(1);
  const copier = await makeUser(2);

  const { data: probs } = await db.from("problems").insert([
    { title_slug: `${tag}-start`, title: "Starter", difficulty: "Medium", question_id: `${tag}-qs`, topics: ["Arrays"] },
    { title_slug: `${tag}-other`, title: "Other", difficulty: "Hard", question_id: `${tag}-qo`, topics: ["Graphs"] },
  ]).select("title_slug");
  made.problems.push(...probs.map((p) => p.title_slug));

  // ── The counter is maintained by a trigger, not by a client write ────────
  const { data: primer } = await db.from("primers").insert({
    slug: `${tag}-primer`, pattern: "Arrays", title: "Probe primer",
    recognize_when: ["probe"], starter_slugs: [`${tag}-start`],
    author_id: author, visibility: "public",
  }).select("id, fork_count").single();
  made.primers.push(primer.id);
  check("a new primer starts with no copies", primer.fork_count, 0);

  await forkOf(primer.id, "primer", copier, daysAgo(5));
  const { data: afterFork } = await db.from("primers").select("fork_count").eq("id", primer.id).single();
  check("copying it increments the author's counter", afterFork.fork_count, 1);

  // ── A solve after the fork, on a starter problem, is a completion ───────
  await solve(copier, `${tag}-start`, daysAgo(4));
  const { data: impact } = await db.rpc("my_content_impact");
  void impact; // author's own rollup needs their session; checked via the view.

  const { data: viewRows } = await db.from("content_impact")
    .select("source_id,source_type,forker_id,solved_at")
    .eq("source_id", primer.id);
  check("the fork shows up in the impact view", (viewRows ?? []).length, 1);
  ok("and it resolved to a solve", Boolean((viewRows ?? [])[0]?.solved_at));

  // ── A solve BEFORE the fork is not a completion ─────────────────────────
  // A dedicated problem for this case. Reusing the first starter problem would
  // be wrong: the copier already solved it for primer1, so a *later* solve
  // legitimately falls inside primer2's window and primer2 would earn credit
  // for something that had nothing to do with it.
  const { data: probs2 } = await db.from("problems").insert([
    { title_slug: `${tag}-late`, title: "Late starter", difficulty: "Medium", question_id: `${tag}-ql`, topics: ["Arrays"] },
  ]).select("title_slug");
  made.problems.push(...probs2.map((p) => p.title_slug));

  const { data: primer2 } = await db.from("primers").insert({
    slug: `${tag}-primer2`, pattern: "Arrays", title: "Probe primer 2",
    recognize_when: ["probe"], starter_slugs: [`${tag}-late`],
    author_id: author, visibility: "public",
  }).select("id").single();
  made.primers.push(primer2.id);

  // Solved the problem BEFORE copying the primer that teaches it.
  await solve(copier, `${tag}-late`, daysAgo(10));
  await forkOf(primer2.id, "primer", copier, daysAgo(5));
  const { data: view2 } = await db.from("content_impact")
    .select("solved_at").eq("source_id", primer2.id);
  check("a solve that happened BEFORE the copy is not counted", (view2 ?? [])[0]?.solved_at ?? null, null);

  // ── Beyond the window is not a completion ──────────────────────────────
  const { data: primer3 } = await db.from("primers").insert({
    slug: `${tag}-primer3`, pattern: "Arrays", title: "Probe primer 3",
    recognize_when: ["probe"], starter_slugs: [`${tag}-start`],
    author_id: author, visibility: "public",
  }).select("id").single();
  made.primers.push(primer3.id);

  await forkOf(primer3.id, "primer", copier, daysAgo(60));
  // The only solve is 4 days ago, i.e. 56 days after the fork.
  const { data: view3 } = await db.from("content_impact")
    .select("solved_at").eq("source_id", primer3.id);
  check("a solve more than 30 days after the copy is not counted", (view3 ?? [])[0]?.solved_at ?? null, null);

  // ── An unrelated problem is not a completion ───────────────────────────
  const { data: primer4 } = await db.from("primers").insert({
    slug: `${tag}-primer4`, pattern: "Arrays", title: "Probe primer 4",
    recognize_when: ["probe"], starter_slugs: [`${tag}-start`],
    author_id: author, visibility: "public",
  }).select("id").single();
  made.primers.push(primer4.id);

  const other = await makeUser(3);
  await forkOf(primer4.id, "primer", other, daysAgo(3));
  await solve(other, `${tag}-other`, daysAgo(2));
  const { data: view4 } = await db.from("content_impact")
    .select("solved_at").eq("source_id", primer4.id);
  check("solving an unrelated problem is not a completion", (view4 ?? [])[0]?.solved_at ?? null, null);

  // ── Approaches count too, and get their own counter ────────────────────
  const { data: approach } = await db.from("approaches").insert({
    user_id: author, problem_slug: `${tag}-start`, pattern: "Arrays",
    core_idea: "Probe approach", visibility: "public",
  }).select("id, fork_count").single();
  made.approaches.push(approach.id);
  check("approaches now have a fork_count column (Step 22 bug)", approach.fork_count, 0);

  await forkOf(approach.id, "approach", other, daysAgo(2));
  await solve(other, `${tag}-start`, daysAgo(1));
  const { data: approachAfter } = await db.from("approaches").select("fork_count").eq("id", approach.id).single();
  check("copying an approach increments its counter", approachAfter.fork_count, 1);
  const { data: viewA } = await db.from("content_impact").select("solved_at").eq("source_id", approach.id);
  ok("and a solve of its problem is a completion", Boolean((viewA ?? [])[0]?.solved_at));

  // ── Deleting the copy decrements ────────────────────────────────────────
  const noteToDelete = made.notes[made.notes.length - 1];
  await db.from("notebook_notes").delete().eq("id", noteToDelete);
  made.notes = made.notes.filter((n) => n !== noteToDelete);
  const { data: afterDelete } = await db.from("approaches").select("fork_count").eq("id", approach.id).single();
  check("deleting the copy decrements the counter", afterDelete.fork_count, 0);
  const { data: viewAfterDelete } = await db.from("content_impact").select("fork_id").eq("source_id", approach.id);
  check("and the chain row goes with it", (viewAfterDelete ?? []).length, 0);

  // ── The headline must not claim impact that did not happen ──────────────
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data: impactRows } = await anon.rpc("my_content_impact");
  void impactRows;

  // The author's own session sees their rollup.
  const authorClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await authorClient.auth.signInWithPassword({
    email: `${tag}_1@example.com`, password: "probe-pw-123",
  });
  if (sErr) throw new Error(`signin: ${sErr.message}`);
  const { data: mine } = await authorClient.rpc("my_content_impact");
  const rows = mine ?? [];

  ok("the author sees their own copied objects", rows.length > 0, `${rows.length} rows`);
  ok("every row has forks", rows.every((r) => typeof r.forks === "number"));
  const withCompletions = rows.filter((r) => r.completions > 0);
  ok("at least one object has a completion", withCompletions.length > 0);
  ok("and its headline says helped, not copies", withCompletions.every((r) => /Helped \d+ developer/.test(r.headline)));
  const withoutCompletions = rows.filter((r) => r.completions === 0);
  ok(
    "an object with copies but no solve says so plainly",
    withoutCompletions.every((r) => /none solved the problem yet/.test(r.headline)),
    withoutCompletions.map((r) => r.headline).join(" | ") || "none"
  );
  ok("no row claims impact with zero forks", rows.every((r) => r.completions === 0 || r.forks > 0));

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);