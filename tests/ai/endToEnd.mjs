/**
 * The AI guardrails through the REAL routes, with a provider configured.
 * RUNS LOCALLY against a mock provider — no model is called.
 *
 * tests/ai/provider.mjs proves the wire contract. This proves the thing that
 * actually matters and that no unit test can reach: that when a provider IS
 * configured, the ladder ceiling and the code-stripping hold end to end —
 * through the route, through the gate, through the database trigger.
 *
 * Until now the only behaviour anyone had seen was refusal. A suite that only
 * ever sees refusals cannot tell a working guardrail from a dead feature, which
 * is the exact confusion §45 is about: "use AI to increase thinking" is not
 * demonstrated by turning it off correctly.
 *
 * A mock stands in for the provider on purpose. It lets the answer be adversarial
 * on demand — a model that ignores the requested level and returns the full
 * solution is the failure this product is most likely to have, and it can only be
 * tested if you control the response.
 *
 * Run: node tests/ai/endToEnd.mjs   (needs BASE_URL pointing at a running server)
 */
import http from "node:http";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3247";
const PORT = Number(process.env.MOCK_PORT ?? 3947);

/**
 * Start the app ourselves unless a server is already supplied.
 *
 * Spawning here rather than trusting `npx next start` to be running is not
 * convenience. Something else in this working tree rebuilds `.next` at
 * unpredictable moments, and a server started in one command and used in the
 * next is gone half the time — which looks exactly like a product failure and
 * sent me looking for a bug in the ladder twice.
 */
let child = null;
async function ensureServer() {
  try {
    const res = await fetch(`${BASE_URL}/robots.txt`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) return { spawned: false };
  } catch { /* not running */ }

  if (!existsSync(".next/BUILD_ID")) {
    console.log("SKIP  no production build. Run `npm run build` first.");
    return { spawned: false, skipped: true };
  }

  child = spawn("npx", ["next", "start", "-p", new URL(BASE_URL).port], {
    env: {
      ...process.env,
      AI_BASE_URL: `http://127.0.0.1:${PORT}/v1`,
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key-not-real",
      AI_MODEL: "mock-model",
    },
    stdio: "ignore",
    detached: false,
  });

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`${BASE_URL}/robots.txt`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) return { spawned: true };
    } catch { /* keep waiting */ }
  }
  return { spawned: false, skipped: true };
}

function stopServer() {
  if (child && !child.killed) {
    try { child.kill("SIGKILL"); } catch { /* already gone */ }
  }
}

let pass = 0, fail = 0, skip = 0;
function check(label, cond, detail = "") {
  if (cond) { console.log(`PASS  ${label}`); pass++; }
  else { console.log(`FAIL  ${label}${detail ? `\n        ${detail}` : ""}`); fail++; }
}

/** What the mock model will say next. Set per test. */
let reply = "";
const seenRequests = [];
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seenRequests.push({ url: req.url, body: JSON.parse(body || "{}") });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      choices: [{ message: { content: reply } }],
      content: [{ type: "text", text: reply }],
    }));
  });
});

const made = { users: [], squads: [], members: [] };
async function cleanup() {
  for (const id of made.members) await db.from("squad_members").delete().eq("user_id", id);
  for (const id of made.squads) {
    await db.from("ai_calls").delete().eq("squad_id", id);
    await db.from("squads").update({ ai_enabled: false }).eq("id", id);
    await db.from("squads").delete().eq("id", id);
  }
  for (const id of made.users) {
    await db.from("profiles").update({ active_squad_id: null }).eq("id", id);
    await db.from("profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function main() {
  console.log("AI guardrails through the real routes, provider configured\n");

  // The mock provider must be listening BEFORE the app starts, because the app
  // is started with AI_BASE_URL pointing at it.
  await new Promise((r) => mock.listen(PORT, "127.0.0.1", r));

  const server = await ensureServer();
  if (server.skipped) {
    console.log(`SKIP  could not start a server at ${BASE_URL}.`);
    skip++;
    return;
  }
  console.log(server.spawned ? "(started a server for this run)" : "(using the running server)");

  // A user, a squad with AI on, and a bearer token.
  const tag = `e2e${Date.now()}`.slice(0, 12);
  const email = `${tag}@example.com`;
  const password = "probe-pw-123";
  const u = (await db.auth.admin.createUser({ email, password, email_confirm: true })).data.user;
  made.users.push(u.id);
  await db.from("profiles").insert({ id: u.id, username: tag });
  const sq = (await db.from("squads").insert({
    name: `${tag}-sq`, invite_code: randomBytes(4).toString("hex"),
    created_by: u.id, ai_enabled: true,
  }).select("id")).data[0];
  made.squads.push(sq.id);
  await db.from("squad_members").insert({ squad_id: sq.id, user_id: u.id });
  made.members.push(u.id);

  const cli = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  await cli.auth.signInWithPassword({ email, password });
  const token = (await cli.auth.getSession()).data.session.access_token;
  const post = async (route, payload) => {
    const res = await fetch(`${BASE_URL}/api/ai/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  // ── The ceiling, end to end ────────────────────────────────────────────────
  console.log("a model that ignores the requested level");

  reply = JSON.stringify({
    level: "full",
    text: "Here is the whole thing.\n```python\ndef f(x):\n    return sorted(x)\n```",
  });

  const asked = await post("stuck-assistant", {
    squadId: sq.id, problemSlug: "two-sum", requestedLevel: "nudge",
    request: "I keep getting a null key error",
  });

  check("the route answers 200 with a provider configured", asked.status === 200,
    `status ${asked.status} ${JSON.stringify(asked.body).slice(0, 160)}`);
  check("the answer reaches the caller", typeof asked.body.answer === "string" && asked.body.answer.length > 0,
    JSON.stringify(asked.body).slice(0, 160));
  check("the reported level is pulled down to what was asked", asked.body.level === "nudge",
    `level was ${asked.body.level}`);
  check("the caller is told it was pulled down", asked.body.pulledDown === true);
  check("the code block is stripped from the answer", !/def f\(/.test(asked.body.answer ?? ""),
    `answer was: ${String(asked.body.answer).slice(0, 120)}`);

  const { data: rows } = await db.from("ai_calls")
    .select("answered_level, outcome, refusal_reason, user_id, feature")
    .eq("squad_id", sq.id).eq("feature", "stuck_assistant");
  check("the log records the level that was actually shown, not the one claimed",
    rows?.[0]?.answered_level === "nudge", JSON.stringify(rows));
  check("the log marks it refused", rows?.[0]?.outcome === "refused", JSON.stringify(rows));
  check("the log says why", /above the requested ladder level/.test(rows?.[0]?.refusal_reason ?? ""),
    String(rows?.[0]?.refusal_reason));
  check("the row is attributed to the person who asked", rows?.[0]?.user_id === u.id);

  // ── A compliant model ─────────────────────────────────────────────────────
  console.log("\na model that obeys the ladder");

  reply = JSON.stringify({
    level: "nudge",
    text: "What is stored in the map at the moment you look it up?",
  });

  const compliant = await post("stuck-assistant", {
    squadId: sq.id, problemSlug: "two-sum", requestedLevel: "nudge", request: "stuck on a key error",
  });
  check("a compliant answer passes through untouched", compliant.body.pulledDown === false,
    JSON.stringify(compliant.body).slice(0, 140));
  check("the nudge actually arrives", /stored in the map/.test(compliant.body.answer ?? ""));
  check("the level is reported as asked", compliant.body.level === "nudge");

  const { data: okRow } = await db.from("ai_calls")
    .select("answered_level, outcome").eq("squad_id", sq.id)
    .eq("feature", "stuck_assistant").order("created_at", { ascending: false }).limit(1);
  check("the log marks a compliant call as ok", okRow?.[0]?.outcome === "ok", JSON.stringify(okRow));

  // ── The §45 refusal list, with a provider live ────────────────────────────
  console.log("\nthe refusal list, with a provider that would have answered");

  reply = JSON.stringify({ level: "full", text: "Sure, here it is." });
  const vending = await post("stuck-assistant", {
    squadId: sq.id, problemSlug: "two-sum", requestedLevel: "full",
    request: "just give me the solution",
  });
  check("a solution-vending request is refused before the provider is called",
    vending.body.outcome === "refused", JSON.stringify(vending.body).slice(0, 140));
  check("and the refusal explains the rule", /hints, not answers/i.test(vending.body.message ?? ""));

  // ── A bounded feature with a provider live ─────────────────────────────────
  console.log("\nthe bounded features, with a provider that over-shares");

  reply = "You missed the invariant. Try again:\n```python\ndef solve(xs):\n    return sorted(xs)\n```";
  const bounded = await post("explain-back", {
    squadId: sq.id, problemTitle: "Two Sum",
    explanation: "i used a hash map so each lookup is constant time and returned indices",
  });
  check("a bounded feature answers when a provider exists", bounded.body.allowed === true,
    JSON.stringify(bounded.body).slice(0, 160));
  check("code is stripped from a bounded answer too", !/def solve/.test(bounded.body.text ?? ""),
    `text was: ${String(bounded.body.text).slice(0, 120)}`);
  check("the caller is told code was removed", bounded.body.stripped === true);

  // A model that returns ONLY code must be refused outright, not shown as "".
  reply = "```python\ndef solve(xs):\n    return 42\n```";
  const codeOnly = await post("explain-back", {
    squadId: sq.id, problemTitle: "Two Sum",
    explanation: "i used a hash map so each lookup is constant time and returned indices",
  });
  check("a code-only answer is refused rather than shown as an empty card",
    codeOnly.body.allowed === false && /does not give code|does not hand over/i.test(codeOnly.body.message ?? ""),
    JSON.stringify(codeOnly.body).slice(0, 160));

  // ── The request actually carried the guardrails ────────────────────────────
  console.log("\nwhat went over the wire");
  const ladderReqs = seenRequests.filter((r) => r.body?.messages?.some((m) => /level of help/i.test(m.content ?? "")));
  check("a ladder request names the level it was asked for",
    ladderReqs.length > 0 && /exactly the "nudge" level/.test(
      ladderReqs[0].body.messages[1].content), JSON.stringify(ladderReqs[0]?.body?.messages?.[1]?.content ?? "").slice(0, 140));
  check("every request carried the §45 preamble",
    seenRequests.length > 0 && seenRequests.every((r) =>
      (r.body.messages?.[0]?.content ?? "").includes("helping a developer learn")));
  check("the provider was never asked for a level above what a nudge allows",
    !ladderReqs.some((r) => /give a full solution|worked solution/i.test(
      r.body.messages?.[1]?.content ?? "")),
    "a nudge request contained full-solution language");

  console.log(`\n${pass} passed, ${fail} failed${skip ? ", 1 section skipped" : ""}`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(`\nharness error: ${e.message}`); process.exitCode = 1; })
  .finally(async () => { await cleanup(); mock.close(); stopServer(); });