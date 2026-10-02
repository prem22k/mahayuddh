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

let pass = 0, fail = 0;
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

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);