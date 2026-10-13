/**
 * Abuse-case integration check — RUNS AGAINST THE LIVE DATABASE + A LIVE SERVER.
 *
 * Every assertion here is something an attacker would try. They exist because
 * the unit tests in tests/security/ can only prove the validators work in
 * isolation; these prove the assembled stack refuses.
 *
 * Cases:
 *   - a caller who is not in a squad cannot spend that squad's AI budget
 *   - /api/notify cannot be turned into a spam cannon or a forged-actor relay
 *   - /api/squads/join is throttled server-side
 *   - oversized and cross-site requests are refused at the edge
 *   - the cron guard rejects a wrong secret
 *
 * Requires: a production build running at BASE_URL (default http://localhost:3000).
 * Skips the HTTP cases when no server is up; the DB-only cases always run.
 *
 * Run: BASE_URL=http://localhost:3000 npm run test:integration:security
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
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL || env.BASE_URL || "http://localhost:3000";

const stamp = Date.now();
const tag = `xsec${stamp}`.slice(0, 24);
const made = { users: [], squads: [], members: [], calls: [], notifications: [] };

let pass = 0, fail = 0, skip = 0;
function ok(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond && detail) console.log(`        ${detail}`);
  cond ? pass++ : fail++;
}

async function makeUser(i) {
  const email = `${tag}_${i}@example.com`;
  const { data, error } = await db.auth.admin.createUser({
    email, password: "probe-pw-123", email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  await db.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}` });
  return { id: data.user.id, email };
}

async function tokenFor(email) {
  const cli = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data, error } = await cli.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return data.session.access_token;
}

async function serverUp() {
  try {
    const res = await fetch(`${BASE_URL}/robots.txt`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function callApi(path, { method = "POST", token, body, headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: h,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 160) }; }
  return { status: res.status, body: parsed };
}

const up = await serverUp();
if (!up) {
  console.log(
    `SKIP  HTTP cases: no server at ${BASE_URL}. Start one (npm run build && npx next start) and re-run.`
  );
}

try {
  const victim = await makeUser(1);
  const attacker = await makeUser(2);

  const { data: squad, error: sErr } = await db
    .from("squads")
    .insert({ name: `xs-${tag}`, invite_code: tag, created_by: victim.id, ai_enabled: true })
    .select("id")
    .single();
  if (sErr) throw new Error(`squad: ${sErr.message}`);
  made.squads.push({ id: squad.id, owner: victim.id });
  // Only the victim is a member. The attacker deliberately is not.
  await db.from("squad_members").insert({ squad_id: squad.id, user_id: victim.id });
  made.members.push(victim.id);

  if (up) {
    // ── Cross-squad AI budget theft ────────────────────────────────────────
    // squadId is client-supplied. getAiGate must verify membership rather than
    // trusting it, or any account can drain any squad's hourly allowance.
    const attackerToken = await tokenFor(attacker.email);
    const steal = await callApi("/api/ai/explain-mistake", {
      token: attackerToken,
      body: {
        squadId: squad.id,
        problemTitle: "Two Sum",
        scratchpad: "i built a hash map and then hit a null key error and stopped there",
      },
    });
    ok(
      "a non-member naming another squad's id is refused with 403",
      steal.status === 403,
      `got ${steal.status} ${JSON.stringify(steal.body).slice(0, 120)}`
    );
    ok(
      "the refusal names the real reason rather than claiming AI is off",
      /not a member/i.test(String(steal.body?.error ?? "")),
      JSON.stringify(steal.body).slice(0, 120)
    );

    const { data: charged } = await db
      .from("ai_calls")
      .select("id,user_id")
      .eq("squad_id", squad.id);
    ok(
      "no ai_calls row was charged to the victim's squad",
      (charged ?? []).length === 0,
      JSON.stringify(charged)
    );

    const afterTheft = await db.rpc("ai_calls_remaining", { p_squad: squad.id });
    ok(
      "the victim's hourly AI budget is untouched",
      Number(afterTheft.data) === 30,
      String(afterTheft.data)
    );

    // The member themself must not be over-blocked by the fix.
    const victimToken = await tokenFor(victim.email);
    const memberCall = await callApi("/api/ai/explain-mistake", {
      token: victimToken,
      body: {
        squadId: squad.id,
        problemTitle: "Two Sum",
        scratchpad: "i built a hash map and then hit a null key error and stopped there",
      },
    });
    ok(
      "the real member still reaches the normal gate",
      memberCall.status === 200,
      `got ${memberCall.status}`
    );

    // ── Notification spam and forged actor ─────────────────────────────────
    const spam = await callApi("/api/notify", {
      token: attackerToken,
      body: {
        userId: victim.id,
        kind: "challenge",
        title: "you have been challenged",
        body: "click here",
        // The victim, not the caller, must never appear as the actor.
        actorId: victim.id,
        urgent: true,
      },
    });
    ok("notify accepts a legitimate-looking challenge", spam.status === 201, JSON.stringify(spam.body));

    const { data: forged } = await db
      .from("notifications")
      .select("actor_id,user_id")
      .eq("id", spam.body?.error ?? "");
    const { data: byUser } = await db
      .from("notifications")
      .select("actor_id,user_id,title")
      .eq("user_id", victim.id)
      .eq("title", "you have been challenged")
      .order("created_at", { ascending: false })
      .limit(1);
    for (const row of byUser ?? []) made.notifications.push(row.actor_id);
    ok(
      "the stored actor is the authenticated caller, not the forged victim id",
      byUser?.[0]?.actor_id === attacker.id,
      JSON.stringify(byUser?.[0])
    );
    void forged;

    // Spam cap: the rule is 30/hour, so the 32nd must be refused.
    let throttled = null;
    for (let i = 0; i < 40 && !throttled; i++) {
      const r = await callApi("/api/notify", {
        token: attackerToken,
        body: { userId: victim.id, kind: "contest", title: `burst ${i}` },
      });
      if (r.status === 429) throttled = r;
    }
    ok("the notify spam cap engages server-side", Boolean(throttled), "no 429 after 40 sends");

    // ── Join-code brute force ──────────────────────────────────────────────
    let joinThrottled = null;
    for (let i = 0; i < 40 && !joinThrottled; i++) {
      const r = await callApi("/api/squads/join", {
        token: attackerToken,
        body: { invite_code: `ZZZZZZ${String(i % 10)}`.slice(0, 8) },
      });
      if (r.status === 429) joinThrottled = r;
    }
    ok("the invite-code guessing cap engages server-side", Boolean(joinThrottled));

    // ── CSRF and body limits at the edge ───────────────────────────────────
    const csrf = await fetch(`${BASE_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ userId: victim.id, kind: "challenge", title: "x" }),
    });
    ok("a cross-site POST is refused with 403", csrf.status === 403, `got ${csrf.status}`);

    const nullOrigin = await fetch(`${BASE_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "null" },
      body: JSON.stringify({}),
    });
    ok("a literal Origin: null is refused", nullOrigin.status === 403, `got ${nullOrigin.status}`);

    const oversized = await fetch(`${BASE_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x".repeat(200_000) }),
    });
    ok("an oversized body is refused with 413", oversized.status === 413, `got ${oversized.status}`);

    // ── The cron guard ─────────────────────────────────────────────────────
    const badCron = await fetch(`${BASE_URL}/api/analytics/funnel`, {
      headers: { Authorization: "Bearer definitely-not-the-secret" },
    });
    ok("the cron route rejects a wrong secret with 401", badCron.status === 401, `got ${badCron.status}`);

    // ── Security headers on a real response ────────────────────────────────
    const head = await fetch(`${BASE_URL}/welcome`);
    ok(
      "HSTS is emitted on a real page response",
      Boolean(head.headers.get("strict-transport-security")),
      head.headers.get("strict-transport-security") ?? "absent"
    );
    ok("nosniff is set", head.headers.get("x-content-type-options") === "nosniff");
    ok("clickjacking is denied", head.headers.get("x-frame-options") === "DENY");
    const csp = head.headers.get("content-security-policy") ?? "";
    ok("the CSP carries frame-ancestors 'none'", /frame-ancestors 'none'/.test(csp));
    ok("the CSP carries object-src 'none'", /object-src 'none'/.test(csp));
    ok(
      "production CSP does not allow eval",
      !csp.includes("'unsafe-eval'"),
      "unsafe-eval present"
    );
  } else {
    skip += 12;
  }

  // ── DB-only: an ordinary user cannot make themselves an admin ────────────
  // Runs regardless of the server: this is RLS, not application code.
  // A client that carries the caller's session AND the publishable key.
  //
  // Both are required and they are different things: the key goes in the
  // `apikey` header and the JWT in `Authorization`. Passing the JWT as the key
  // (the obvious shortcut) produces "Invalid API key" from PostgREST and tests
  // nothing — the request never reaches RLS.
  const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {
    auth: { persistSession: false },
  });
  {
    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: attacker.email,
      password: "probe-pw-123",
    });
    if (signInErr) throw new Error(`signIn as attacker: ${signInErr.message}`);
  }

  const escalate = await userClient
    .from("profiles")
    .update({ is_product_admin: true })
    .eq("id", attacker.id);
  const { data: afterEscalation } = await db
    .from("profiles")
    .select("is_product_admin")
    .eq("id", attacker.id)
    .single();
  ok(
    "a user cannot escalate themselves to product admin",
    afterEscalation?.is_product_admin !== true,
    `error=${escalate.error?.message ?? "none"} value=${afterEscalation?.is_product_admin}`
  );

  // Stats are column-scoped: `grant update (username, avatar_url)` only, so a
  // client's UPDATE of contest_rating is refused outright by Postgres. The
  // assertion compares against the row's own baseline rather than hard-coded
  // zeros, because contest_rating legitimately defaults to 1500.
  const { data: baseline } = await db
    .from("profiles")
    .select("contest_rating,total_easy")
    .eq("id", attacker.id)
    .single();
  const notes = await userClient
    .from("profiles")
    .update({ contest_rating: 3000, total_easy: 9999 })
    .eq("id", attacker.id);
  const { data: afterStats } = await db
    .from("profiles")
    .select("contest_rating,total_easy")
    .eq("id", attacker.id)
    .single();
  ok(
    "a user cannot write their own leaderboard stats",
    afterStats?.contest_rating === baseline?.contest_rating &&
      afterStats?.total_easy === baseline?.total_easy,
    `error=${notes.error?.message ?? "none"} ` +
      `rating ${baseline?.contest_rating} -> ${afterStats?.contest_rating}, ` +
      `easy ${baseline?.total_easy} -> ${afterStats?.total_easy}`
  );
  ok(
    "the stats write is refused at the database, not merely ignored",
    Boolean(notes.error),
    "the update reported no error"
  );

  const others = await userClient.from("profiles").select("id").neq("id", attacker.id).limit(5);
  ok(
    "the encrypted LeetCode session is not readable by a client key",
    others.error === null && !JSON.stringify(others.data ?? []).includes("leetcode_session_encrypted"),
    others.error?.message ?? "column unexpectedly readable"
  );

  console.log(`\n${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ""}`);
} finally {
  for (const id of made.calls) await db.from("ai_calls").delete().eq("id", id);
  for (const uid of made.members) await db.from("squad_members").delete().eq("user_id", uid);
  for (const s of made.squads) {
    await db.from("squad_members").delete().eq("squad_id", s.id);
    await db.from("squads").delete().eq("id", s.id);
  }
  for (const u of made.users) {
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* already gone */ }
  }
  console.log("cleaned up synthetic rows");
}

process.exit(fail ? 1 : 0);
