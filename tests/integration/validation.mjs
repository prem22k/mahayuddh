/**
 * Step 27 — validation gates, observation log and triage. RUNS AGAINST THE LIVE DB.
 *
 * Step 27 is a two-week test with real squads, and this file does not pretend to
 * be that test. What it pins is the property the test depends on: that a gate
 * which has nobody to measure says "no data" instead of "fail".
 *
 * That distinction is the whole reason this suite exists. A dashboard that
 * reports 0% activation for an empty squad is worse than no dashboard, because
 * §76 says "if the answer is no, stop adding surface area" — a false no there
 * argues for deleting the product, and a false yes argues for building more of
 * it. Both are confidently wrong.
 *
 * Checks:
 *   - each gate returns no row for a squad with no members
 *   - the board assembles all five gates in §58's order
 *   - the qualitative gate is absent from the board, not counted-and-lost
 *   - gate text cannot name a person (the functions are callable by anon)
 *   - observations are private to the observer, anonymous insert rejected
 *   - triage is world-readable but admin-writable
 *
 * Run: npm run test:integration:validation
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const stamp = Date.now();
const tag = `val${stamp}`.slice(0, 16);
const made = { users: [], squads: [], observations: [], triage: [] };

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

async function makeUser() {
  const email = `${tag}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  const username = `${tag}${Math.random().toString(36).slice(2, 5)}`.slice(0, 24);
  const { error: pErr } = await service.from("profiles").insert({ id: data.user.id, username });
  if (pErr) throw new Error(`profile: ${pErr.message}`);
  return { id: data.user.id, email };
}

async function makeSquad(owner) {
  const code = randomBytes(4).toString("hex");
  const name = `${tag}-squad-${randomBytes(3).toString("hex")}`;
  const { data, error } = await service.from("squads")
    .insert({ name, invite_code: code, created_by: owner }).select().single();
  if (error) throw new Error(`squad: ${error.message}`);
  made.squads.push(data.id);
  return data.id;
}

async function asUser(email) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function cleanup() {
  for (const id of made.observations) await service.from("validation_observations").delete().eq("id", id);
  for (const f of made.triage) await service.from("feature_triage").delete().eq("feature", f);
  await service.from("squad_members").delete().in("squad_id", made.squads);
  await service.from("squads").delete().in("id", made.squads);
  for (const id of made.users) {
    await service.from("profiles").delete().eq("id", id);
    await service.auth.admin.deleteUser(id);
  }
}

async function main() {
  console.log("Step 27 — validation gates and observation log\n");

  const observer = await makeUser();
  const emptySquad = await makeSquad(observer.id);

  console.log("an empty squad must measure as unknown, not as failure");
  for (const fn of ["gate_activation", "gate_social", "gate_learning", "gate_retention", "gate_organic"]) {
    await check(`${fn} returns no row for a squad with no members`, async () => {
      const { data, error } = await service.rpc(fn, { p_squad_id: emptySquad });
      assert(!error, `error: ${error?.message}`);
      // The functions are deliberately shaped to emit nothing when there is
      // nothing to measure, so `unknown` is reachable rather than theoretical.
      assert((data ?? []).length === 0,
        `expected 0 rows, got ${(data ?? []).length}: ${JSON.stringify(data)}`);
    });
  }

  await check("validation_gate_board returns no rows for an empty squad", async () => {
    const { data, error } = await service.rpc("validation_gate_board", { p_squad_id: emptySquad });
    assert(!error, `error: ${error?.message}`);
    assert((data ?? []).length === 0, `expected 0 rows, got ${(data ?? []).length}`);
  });

  await check("validation_squads omits a squad with no members", async () => {
    const { data } = await service.rpc("validation_squads");
    assert(!(data ?? []).some((s) => s.squad_id === emptySquad),
      "an empty squad should not appear in the picker");
  });

  // ── with a member ──────────────────────────────────────────────────────────
  const squad = emptySquad;
  await service.from("squad_members").insert({ squad_id: squad, user_id: observer.id });

  await check("every gate reports once a member exists", async () => {
    const { data, error } = await service.rpc("validation_gate_board", { p_squad_id: squad });
    assert(!error, `error: ${error?.message}`);
    assert((data ?? []).length === 5, `expected 5 gates, got ${(data ?? []).length}`);
    assert((data ?? []).every((g) => typeof g.measured === "string" && g.measured.length > 0),
      "every gate must report what it counted, including the failures");
    assert((data ?? []).every((g) => typeof g.detail === "string" && g.detail.length > 0),
      "every gate must say why it says what it says");
  });

  await check("the board has at most one row per gate", async () => {
    // 00039 gave gate_activation a `group by m.squad_id` while adding the demo
    // exclusion, which turned it from a verdict into a per-squad list. The board
    // returned six rows with "activation" twice. buildGates() collapses duplicates
    // through a Map, so the page kept showing five cards and the UI never showed
    // it — only the row count did.
    const { data, error } = await service.rpc("validation_gate_board", { p_squad_id: null });
    assert(!error, `error: ${error?.message}`);
    const ids = (data ?? []).map((g) => g.gate);
    const distinct = new Set(ids);
    assert(ids.length === distinct.size,
      `duplicate gate rows: ${ids.join(", ")}`);
    assert(ids.length <= 5, `board returned ${ids.length} rows for 5 gates`);
  });

  await check("a whole-scope gate counts the whole scope, not one squad", async () => {
    const { data } = await service.rpc("gate_activation", { p_squad_id: null });
    assert((data ?? []).length === 1,
      `gate_activation emitted ${(data ?? []).length} rows for a whole-scope query`);
    // The whole-scope denominator is every NON-DEMO member, so compare against
    // that and not against the raw row count: counting demo members here would be
    // the bug the demo flag exists to prevent.
    const { data: demoSquads } = await service.from("squads").select("id").eq("is_demo", true);
    const demoIds = new Set((demoSquads ?? []).map((s) => s.id));
    // Both columns, or r.user_id is undefined and the Set collapses to size 1 —
    // which is exactly what this assertion reported.
    const { data: memberRows } = await service.from("squad_members").select("squad_id, user_id");
    const nonDemoMembers = new Set(
      (memberRows ?? []).filter((r) => !demoIds.has(r.squad_id)).map((r) => r.user_id)
    ).size;

    const m = /^(\d+) of (\d+) members/.exec((data ?? [])[0]?.measured ?? "");
    assert(m, `unparseable measured string: ${(data ?? [])[0]?.measured}`);
    assert(Number(m[2]) === nonDemoMembers,
      `denominator ${m[2]} should be the ${nonDemoMembers} non-demo members`);
  });

  await check("the board returns gates in §58's order", async () => {
    const { data } = await service.rpc("validation_gate_board", { p_squad_id: squad });
    assert(JSON.stringify((data ?? []).map((g) => g.gate))
      === JSON.stringify(["activation", "social", "learning", "retention", "organic"]),
      `wrong order: ${(data ?? []).map((g) => g.gate).join(", ")}`);
  });

  await check("the qualitative gate is absent, not counted", async () => {
    const { data } = await service.rpc("validation_gate_board", { p_squad_id: squad });
    // Five gates, and qualitative is not one of them: it has no automated answer.
    assert(!(data ?? []).some((g) => /qualitative/i.test(g.gate)),
      "a gate with no query behind it must not appear as a measured row");
  });

  await check("an inactive member fails activation without a percentage", async () => {
    const { data } = await service.rpc("gate_activation", { p_squad_id: squad });
    const row = (data ?? [])[0];
    assert(row.passed === false, "a member with no battle must not pass");
    assert(/^0 of \d+ members/.test(row.measured),
      `expected '0 of N members…', got '${row.measured}'`);
  });

  await check("gate output cannot name a person", async () => {
    // These functions are granted to anon so a member can review their own
    // squad. That is only safe if the text carries counts, never identities.
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anon.rpc("validation_gate_board", { p_squad_id: squad });
    assert(!error, `anon call failed: ${error?.message}`);
    const { data: profile } = await service.from("profiles").select("username").eq("id", observer.id).single();
    const blob = JSON.stringify(data ?? []);
    assert(!blob.includes(profile.username), `gate output leaked username: ${profile.username}`);
  });

  // ── §59 observation log ────────────────────────────────────────────────────
  console.log("\nthe observation log must not be readable or writable by the wrong party");

  await check("anonymous observation insert is rejected", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.from("validation_observations")
      .insert({ category: "hesitation", observation: "anon attempt", observed_by: observer.id });
    assert(error, "RLS allowed an anonymous insert");
  });

  await check("an insert naming someone else as observer is rejected", async () => {
    const other = await makeUser();
    const c = await asUser(observer.email);
    const { error } = await c.from("validation_observations")
      .insert({ category: "hesitation", observation: "forged", observed_by: other.id });
    assert(error, "RLS allowed attributing an observation to another account");
  });

  await check("an insert with no observer is rejected", async () => {
    const c = await asUser(observer.email);
    const { error } = await c.from("validation_observations")
      .insert({ category: "hesitation", observation: "anonymous" });
    assert(error, "RLS allowed an observation with no observer");
  });

  await check("the observer can record and read back their own observation", async () => {
    const c = await asUser(observer.email);
    const { data, error } = await c.from("validation_observations")
      .insert({ category: "hesitation", observation: "waited here for a minute", day_number: 1, squad_id: squad, observed_by: observer.id })
      .select("id").single();
    assert(!error, `insert failed: ${error?.message}`);
    made.observations.push(data.id);
    const { data: rows } = await c.from("validation_observations")
      .select("observation").eq("id", data.id);
    assert(rows?.[0]?.observation === "waited here for a minute", "could not read back own observation");
  });

  await check("an empty observation is rejected by the check constraint", async () => {
    const { error } = await service.from("validation_observations")
      .insert({ category: "hesitation", observation: "   ", observed_by: observer.id });
    assert(error, "whitespace was accepted as an observation");
  });

  await check("an unknown category is rejected", async () => {
    const { error } = await service.from("validation_observations")
      .insert({ category: "vibes", observation: "nope", observed_by: observer.id });
    assert(error, "an unknown category was accepted");
  });

  await check("day_number outside 1..14 is rejected", async () => {
    const { error } = await service.from("validation_observations")
      .insert({ category: "hesitation", observation: "day 99", day_number: 99, observed_by: observer.id });
    assert(error, "day_number outside the two-week window was accepted");
  });

  // ── §60 triage ─────────────────────────────────────────────────────────────
  console.log("\n§60: a decision everyone can read, that only an admin can make");

  const feature = `${tag}-proposal`;
  made.triage.push(feature);

  await check("a signed-in member CAN propose a feature", async () => {
    // §60: "Every proposed feature gets one of these labels." Proposals come
    // from whoever noticed something. It was admin-only until 00033, which meant
    // the researcher collecting requests could not file one.
    const c = await asUser(observer.email);
    const { error } = await c.from("feature_triage").insert({ feature });
    assert(!error, `a signed-in member could not propose a feature: ${error?.message}`);
  });

  await check("an anonymous visitor cannot propose a feature", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.from("feature_triage").insert({ feature: `${feature}-anon` });
    assert(error, "RLS allowed an anonymous proposal");
    const { error: claim } = await anon.from("feature_triage").insert({ feature: `${feature}-anon2`, label: "CORE" });
    assert(claim, "RLS allowed an anonymous labelled proposal");
  });

  await check("a member cannot smuggle a label in with the proposal", async () => {
    // The insert policy cannot check the label, so the trigger does: a label is a
    // commitment and the rule belongs in the database, not in the client.
    const c = await asUser(observer.email);
    const { error } = await c.from("feature_triage").insert({ feature: `${feature}-sneaky`, label: "CORE" });
    assert(error, "a non-admin attached a label at insert time");
  });

  await check("a non-admin cannot label a feature", async () => {
    const c = await asUser(observer.email);
    // Asserted on the EFFECT, not on `error`. PostgREST returns no error and
    // zero rows for an UPDATE that RLS filtered out, so a test asserting
    // "no error" here would pass against a policy with no restriction on it at
    // all — silently passing a test that proves nothing.
    const { data: rows } = await c.from("feature_triage")
      .update({ label: "CORE" }).eq("feature", feature).select();
    const { data: after } = await service.from("feature_triage")
      .select("label").eq("feature", feature).single();
    assert(after.label === null,
      `a non-admin assigned a label: ${after.label} (${rows?.length ?? 0} rows returned)`);
  });

  await check("anyone signed in can read the queue", async () => {
    const c = await asUser(observer.email);
    const { data, error } = await c.from("feature_triage").select("feature").eq("feature", feature);
    assert(!error, `read failed: ${error?.message}`);
    assert(data?.length === 1, "the queue was not readable by a member");
  });

  await check("the same feature cannot be queued twice, case-insensitively", async () => {
    const { error } = await service.from("feature_triage").insert({ feature: feature.toUpperCase() });
    assert(error, "duplicate feature was accepted; the lower(feature) index is not doing its job");
  });

  await check("an unknown label is rejected", async () => {
    const { error } = await service.from("feature_triage")
      .update({ label: "MAYBE" }).eq("feature", feature);
    assert(error, "a label outside §60's six was accepted");
  });

  await check("a null label is allowed, because §60 decides after the fields", async () => {
    const { error } = await service.from("feature_triage").update({ label: null }).eq("feature", feature);
    assert(!error, `clearing the label was rejected: ${error?.message}`);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  // process.exitCode, NOT process.exit(1). An immediate exit skips the .finally
  // below, so every failing run used to strand its users, squads and triage rows
  // in the live database. A test that leaks when it fails is worse than no test,
  // because the leftovers get read as real data by the gates above.
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(`\nharness error: ${e.message}`); process.exitCode = 1; })
  .finally(cleanup);
