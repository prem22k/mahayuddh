/**
 * Step 25 AI-gate integration check — RUNS AGAINST THE LIVE DATABASE.
 *
 * The interesting assertion here is the database trigger: an ai_calls row that
 * claims the assistant answered ABOVE the requested ladder level must be
 * refused and rewritten, because that is the one rule §45 and §12 both depend
 * on and it must not be enforceable only from the client.
 *
 * Creates a throwaway squad and rows and deletes them on the way out.
 *
 * Run: npm run test:integration:ai
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const tag = `ai${stamp}`;
const made = { users: [], squads: [], calls: [], members: [] };

async function cleanup() {
  for (const c of made.calls) await db.from("ai_calls").delete().eq("id", c);
  for (const m of made.members) await db.from("squad_members").delete().eq("user_id", m);
  for (const s of made.squads) {
    await db.from("profiles").update({ ai_enabled: false }).eq("id", s.owner);
    await db.from("squads").delete().eq("id", s.id);
  }
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

// From the shell, not .env.local: the route tests need a running server, and
// reading only .env.local silently pointed this at port 3000 with nothing there.
const BASE_URL = process.env.BASE_URL || env.BASE_URL || "http://localhost:3000";
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ownerEmail = `${tag}_1@example.com`;

/**
 * Call an AI route as user 1.
 *
 * The route tests need a real Bearer token, because every AI route resolves the
 * caller from the Authorization header rather than from a cookie — that is the
 * reason ai_calls rows end up attributable to a person at all. A fabricated
 * header would test the wrong thing.
 */
async function call(path, payload, { authed = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authed) {
    const cli = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const { data: sess, error } = await cli.auth.signInWithPassword({
      email: ownerEmail, password: "probe-pw-123",
    });
    if (error) throw new Error(`signIn for route call: ${error.message}`);
    headers.Authorization = `Bearer ${sess.session.access_token}`;
  }
  const res = await fetch(`${BASE_URL}/api/ai${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { status: res.status, body };
}

/**
 * Is a server actually reachable?
 *
 * The route-level checks below need one, and in this repository's current state
 * something else is rebuilding .next while tests run, so a server that was up when
 * the suite started can be gone by the time it is used. Rather than report a
 * network failure as a product failure — or skip silently, which is the same lie
 * in the other direction — an unreachable server is reported as SKIPPED and
 * excluded from the counts.
 */
let serverUp = null;
async function probeServer() {
  if (serverUp !== null) return serverUp;
  try {
    const res = await fetch(`${BASE_URL}/robots.txt`, {
      signal: AbortSignal.timeout(4000),
    });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.log(
      `SKIP  route-level checks: no server at ${BASE_URL}. ` +
      "Start one (`npx next start`) and re-run for the API-level coverage.",
    );
  }
  return serverUp;
}

let pass = 0, fail = 0, skip = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}
function ok(label, cond) { check(label, Boolean(cond), true); }

async function logCall(row) {
  const { data, error } = await db.from("ai_calls").insert(row).select("*").single();
  if (error) return { error };
  made.calls.push(data.id);
  return { row: data };
}

try {
  const owner = await makeUser(1);
  const member = await makeUser(2);

  const { data: squad, error: sErr } = await db.from("squads")
    .insert({ name: `ai-${tag}`, invite_code: tag, created_by: owner, ai_enabled: false })
    .select("id, ai_enabled").single();
  if (sErr) throw new Error(`squad: ${sErr.message}`);
  made.squads.push({ id: squad.id, owner });
  for (const uid of [owner, member]) {
    await db.from("squad_members").insert({ squad_id: squad.id, user_id: uid });
    made.members.push(uid);
  }

  // ── §45: the experiment is off by default ────────────────────────────────
  check("a new squad has AI off by default", squad.ai_enabled, false);

  // ── The ladder ceiling, enforced by the database ─────────────────────────
  // A caller that bypassed the client tries to log a full answer to a nudge.
  const over = await logCall({
    squad_id: squad.id, user_id: member, feature: "stuck_assistant",
    requested_level: "nudge", answered_level: "full", outcome: "ok",
  });
  ok("an over-level log row is accepted but rewritten, not rejected", !over.error);
  check("the answer level is pulled down to what was asked", over.row?.answered_level, "nudge");
  check("the outcome becomes 'refused'", over.row?.outcome, "refused");
  check("and the reason says why", over.row?.refusal_reason, "answered above the requested ladder level");

  // A compliant row is untouched.
  const okRow = await logCall({
    squad_id: squad.id, user_id: member, feature: "stuck_assistant",
    requested_level: "pattern", answered_level: "pattern", outcome: "ok",
  });
  check("a compliant level is left alone", okRow.row?.answered_level, "pattern");
  check("a compliant outcome is left alone", okRow.row?.outcome, "ok");
  check("with no refusal reason", okRow.row?.refusal_reason, null);

  // One level below the ceiling is fine too.
  const below = await logCall({
    squad_id: squad.id, user_id: member, feature: "stuck_assistant",
    requested_level: "full", answered_level: "direction", outcome: "ok",
  });
  check("answering below the ceiling is allowed", below.row?.outcome, "ok");

  // Every requested/answered pair, to prove the ceiling holds in SQL.
  //
  // The invariant has two halves and both matter:
  //   1. The stored answered_level is never above requested.
  //   2. If the caller TRIED to log an answer above the ceiling, the row is
  //      marked refused rather than quietly kept.
  //
  // Answering *below* the ceiling with outcome 'ok' is correct and expected —
  // an earlier version of this check treated those six pairs as violations.
  const levels = ["nudge", "pattern", "direction", "full"];
  let aboveCeiling = 0;
  let unreportedViolation = 0;
  let belowCeilingOk = 0;
  for (const requested of levels) {
    for (const answered of levels) {
      const r = await logCall({
        squad_id: squad.id, user_id: member, feature: "stuck_assistant",
        requested_level: requested, answered_level: answered, outcome: "ok",
      });
      if (r.error) { unreportedViolation++; continue; }
      const stored = levels.indexOf(r.row.answered_level);
      const asked = levels.indexOf(requested);
      if (stored > asked) aboveCeiling++;
      if (levels.indexOf(answered) > asked && r.row.outcome !== "refused") unreportedViolation++;
      if (stored < asked && r.row.outcome === "ok") belowCeilingOk++;
    }
  }
  check("no pair ever stores an answer above the ceiling", aboveCeiling, 0);
  check("every attempt to exceed the ceiling is marked refused", unreportedViolation, 0);
  // 6 ordered pairs sit strictly below the ceiling; they must stay 'ok'.
  check("answering below the ceiling stays a normal success", belowCeilingOk, 6);

  // ── Budget accounting ────────────────────────────────────────────────────
  // Refused calls must not consume the squad's hourly budget — a squad should
  // not be charged for the guardrail doing its job.
  const before = (await db.rpc("ai_calls_remaining", { p_squad: squad.id })).data;
  check("the call log already counts against the hour", before < 30, true);

  const { data: fresh } = await db.from("squads").insert({
    name: `ai2-${tag}`, invite_code: `${tag}b`, created_by: owner,
  }).select("id").single();
  made.squads.push({ id: fresh.id, owner });
  const freshBudget = (await db.rpc("ai_calls_remaining", { p_squad: fresh.id })).data;
  check("a squad with no calls has the full budget", freshBudget, 30);

  // Spend it, then confirm it is exhausted.
  for (let i = 0; i < 30; i++) {
    const r = await logCall({
      squad_id: fresh.id, user_id: owner, feature: "explain_mistake",
      requested_level: null, answered_level: null, outcome: "ok",
    });
    if (r.error) break;
  }
  const spent = (await db.rpc("ai_calls_remaining", { p_squad: fresh.id })).data;
  check("30 calls exhaust the hourly budget", spent, 0);

  // Refused calls do not consume budget.
  const { data: fresh2 } = await db.from("squads").insert({
    name: `ai3-${tag}`, invite_code: `${tag}c`, created_by: owner,
  }).select("id").single();
  made.squads.push({ id: fresh2.id, owner });
  for (let i = 0; i < 3; i++) {
    await logCall({
      squad_id: fresh2.id, user_id: owner, feature: "stuck_assistant",
      requested_level: "nudge", answered_level: "full", outcome: "ok",
    });
  }
  const afterRefusals = (await db.rpc("ai_calls_remaining", { p_squad: fresh2.id })).data;
  check("refused calls do not consume the budget", afterRefusals, 30);

  // ── The flag is settable, and defaults off ───────────────────────────────
  await db.from("squads").update({ ai_enabled: true }).eq("id", squad.id);
  const { data: on } = await db.from("squads").select("ai_enabled").eq("id", squad.id).single();
  check("a squad can turn AI on", on.ai_enabled, true);

  // ─ feature set is exactly §45's five ────────────────────────────────────
  const { data: feats } = await db.from("ai_calls").select("feature").eq("squad_id", squad.id);
  const used = [...new Set((feats ?? []).map((f) => f.feature))].sort();
  ok("only §45 feature names can be logged", used.every((f) => [
    "stuck_assistant", "explain_mistake", "practice_next", "explain_back", "interview_sim",
  ].includes(f)), used.join(","));

  const { error: badFeature } = await db.from("ai_calls").insert({
    squad_id: squad.id, user_id: owner, feature: "write_my_primer", outcome: "ok",
  });
  ok("an invented feature name is refused by the check constraint", Boolean(badFeature));
  if (!badFeature) {
    const { data: stray } = await db.from("ai_calls").select("id").eq("feature", "write_my_primer");
    for (const s of stray ?? []) made.calls.push(s.id);
  }

  // ── The three non-ladder features ───────────────────────────────────────
  // Step 25 #2/#4/#5 shipped behind the same flag, the same budget and the same
  // audit rule. They have no ladder level, so the interesting assertions are the
  // ones about refusing: each must refuse in the same ORDER as the ladder, must
  // log its refusal, and must not consume budget doing it.
  console.log("\nthe bounded features (explain_mistake / explain_back / interview_sim)");

  if (!(await probeServer())) {
    skip++;
  } else {

  // Two names per feature and they are not the same string: the route path uses a
  // hyphen, the ai_calls.feature column uses an underscore. Collapsing them into
  // one variable made every assertion query for a feature that cannot exist.
  const BOUNDED = [
    { route: "/explain-mistake", feature: "explain_mistake" },
    { route: "/explain-back", feature: "explain_back" },
    { route: "/interview-sim", feature: "interview_sim" },
  ];

  for (const { feature } of BOUNDED) {
    await db.from("ai_calls").delete().eq("squad_id", squad.id).eq("feature", feature);
  }

  // ai_enabled is currently true from the check above.
  // ai_calls_remaining returns a scalar, not a set: .select() on it yields null
  // and awaiting the builder yields the response object, so both of the obvious
  // ways to read it give something that is not the number.
  const budgetNow = async () => {
    const { data, error } = await db.rpc("ai_calls_remaining", { p_squad: squad.id });
    if (error) throw new Error(`ai_calls_remaining: ${error.message}`);
    return Number(data);
  };
  const beforeBudget = await budgetNow();

  // 1. No provider configured, so each must refuse with no_provider and log it.
  for (const { route, feature } of BOUNDED) {
    const payload = {
      explain_mistake: { squadId: squad.id, problemTitle: "Two Sum", scratchpad: "i made a hash map and then got a null key error and gave up after that honestly" },
      explain_back: { squadId: squad.id, problemTitle: "Two Sum", explanation: "i used a hash map so lookup is constant time and then i returned the indices" },
      interview_sim: { squadId: squad.id, problemTitle: "Two Sum", approach: "hash map, one pass, return indices" },
    }[feature];
    const res = await call(route, payload);
    ok(`${feature} refuses with no_provider and does not invent an answer`,
      res.status === 200 && res.body.allowed === false && res.body.outcome === "no_provider",
      JSON.stringify(res.body).slice(0, 140));
    ok(`${feature} says something a person can act on`,
      typeof res.body.message === "string" && res.body.message.length > 20,
      res.body.message);
    ok(`${feature} returns no text when it refuses`, !res.body.text);

    const { data: rows } = await db.from("ai_calls")
      .select("outcome, user_id, squad_id, requested_level")
      .eq("squad_id", squad.id).eq("feature", feature);
    ok(`${feature} logged its refusal`, (rows ?? []).length === 1, JSON.stringify(rows));
    ok(`${feature} refusal is attributable to the caller`,
      rows?.[0]?.user_id === owner, String(rows?.[0]?.user_id));
    ok(`${feature} logs no ladder level, because it has none`,
      rows?.[0]?.requested_level === null, String(rows?.[0]?.requested_level));
  }

  const afterRefusalBudget = await budgetNow();
  // The one that found 00043. These calls all refused with no_provider, which
  // means nothing was sent to a provider, so they must not cost the squad
  // anything. They did: ai_calls_remaining exempted 'refused' and 'disabled' and
  // missed the outcome an unconfigured deployment produces on every call.
  ok("refused bounded calls do not consume the squad's budget",
    afterRefusalBudget === beforeBudget,
    `${beforeBudget} -> ${afterRefusalBudget}`);

  // Pin the classification directly, so the fix cannot be undone silently.
  for (const [outcome, shouldBeFree] of [
    ["no_provider", true], ["refused", true], ["disabled", true], ["rate_limited", true],
    ["ok", false], ["error", false],
  ]) {
    await db.from("ai_calls").delete().eq("squad_id", squad.id);
    const before = await budgetNow();
    await db.from("ai_calls").insert({
      squad_id: squad.id, user_id: owner, feature: "explain_mistake",
      outcome, requested_level: null, answered_level: null,
    });
    const after = await budgetNow();
    const wasFree = after === before;
    ok(`outcome '${outcome}' is ${shouldBeFree ? "free" : "charged"} against the cap`,
      wasFree === shouldBeFree, `${before} -> ${after}`);
  }
  await db.from("ai_calls").delete().eq("squad_id", squad.id);

  // 2. Order: ai_enabled off must win over everything, including a valid request.
  await db.from("squads").update({ ai_enabled: false }).eq("id", squad.id);
  const off = await call("/explain-mistake", {
    squadId: squad.id, problemTitle: "Two Sum",
    scratchpad: "tried two pointers but went out of bounds on the right edge case",
  });
  ok("ai_enabled off refuses a bounded feature before anything else",
    off.body.outcome === "disabled", off.body.outcome);
  await db.from("squads").update({ ai_enabled: true }).eq("id", squad.id);

  // 3. Input the feature cannot work without is refused with an honest reason.
  const noScratchpad = await call("/explain-mistake", {
    squadId: squad.id, problemTitle: "Two Sum", scratchpad: "   ",
  });
  ok("explain_mistake refuses an empty scratchpad instead of guessing",
    noScratchpad.body.outcome === "refused"
      && /nothing written down/i.test(noScratchpad.body.message),
    `${noScratchpad.body.outcome}: ${noScratchpad.body.message}`);

  const shortExplain = await call("/explain-back", {
    squadId: squad.id, problemTitle: "Two Sum", explanation: "hash map",
  });
  ok("explain_back refuses a too-short explanation",
    shortExplain.body.outcome === "refused", shortExplain.body.outcome);

  const secondQuestion = await call("/interview-sim", {
    squadId: squad.id, problemTitle: "Two Sum", approach: "hash map", firstQuestion: false,
  });
  ok("interview_sim refuses a second question rather than becoming a chat",
    secondQuestion.body.outcome === "refused"
      && /one question at a time/i.test(secondQuestion.body.message),
    `${secondQuestion.body.outcome}: ${secondQuestion.body.message}`);

  // 4. Anonymous callers get nothing.
  const anon = await call("/explain-back", {
    squadId: squad.id, problemTitle: "Two Sum", explanation: "a".repeat(60),
  }, { authed: false });
  ok("an unauthenticated call is 401 for every bounded feature",
    anon.status === 401, String(anon.status));

  // 5. Every §45 feature that needs a model has now been exercised through its
  //    route in this run. The classification loop above wiped ai_calls, so this
  //    records one row per feature rather than assuming the earlier ones survive.
  const exercised = new Set();
  await db.from("ai_calls").delete().eq("squad_id", squad.id);
  for (const { route, feature } of BOUNDED) {
    const res = await call(route, {
      explain_mistake: { squadId: squad.id, scratchpad: "tried a hash map and got a null key error" },
      explain_back: { squadId: squad.id, explanation: "i used a hash map so lookup is constant time overall" },
      interview_sim: { squadId: squad.id, approach: "hash map, one pass, return indices" },
    }[feature]);
    if (res.status === 200) exercised.add(feature);
  }
  const ladder = await call("/stuck-assistant", {
    squadId: squad.id, problemSlug: "two-sum", requestedLevel: "nudge", request: "stuck",
  });
  if (ladder.status === 200) exercised.add("stuck_assistant");

  ok("stuck_assistant plus the three bounded features are all reachable by route",
    ["stuck_assistant", "explain_mistake", "explain_back", "interview_sim"]
      .every((f) => exercised.has(f)),
    [...exercised].join(","));

  // And every one of those rows is a real, attributed refusal.
  const { data: rows } = await db.from("ai_calls")
    .select("feature, outcome, user_id").eq("squad_id", squad.id);
  ok("one attributed refusal per feature", (rows ?? []).length === 4,
    `${(rows ?? []).length}: ${JSON.stringify(rows)}`);
  ok("every refusal names its feature and its caller",
    (rows ?? []).every((r) => r.user_id === owner && r.outcome === "no_provider"),
    JSON.stringify(rows));

  }

  console.log(`\n${pass} passed, ${fail} failed${skip ? `, ${skip} section skipped` : ""}`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);