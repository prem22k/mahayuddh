/**
 * LeetCode ownership verification integration tests. RUNS AGAINST THE LIVE DB.
 *
 * Run: BASE_URL=http://localhost:xxxx npm run test:integration:lcverify
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
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
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  console.error("BASE_URL is required (the API is exercised, not just the tables).");
  process.exitCode = 2;
}

const tag = `lcv${Date.now()}`.slice(0, 12);
const made = { users: [], battles: [] };
const PW = "probe-pw-123";

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function randomHandle() {
  return `zzlcv${Math.random().toString(36).slice(2, 8)}`;
}

async function makeMember() {
  const email = `${tag}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  const username = `${tag}${Math.random().toString(36).slice(2, 5)}`.slice(0, 24);
  await db.from("profiles").insert({ id: data.user.id, username });

  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await c.auth.signInWithPassword({ email, password: PW });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  return { id: data.user.id, email, token: sess.session.access_token, client: c };
}

async function postApi(path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function cleanup() {
  for (const id of made.battles) {
    await db.from("problem_events").delete().not("battle_id", "is", null).eq("battle_id", id).then(() => {});
    await db.from("battles").delete().eq("id", id);
  }
  if (made.users.length > 0) {
    await db.from("problem_events").delete().in("user_id", made.users);
    await db.from("user_problem_status").delete().in("user_id", made.users);
    await db.from("leetcode_verifications").delete().in("user_id", made.users);
    for (const id of made.users) {
      await db.from("profiles").delete().eq("id", id);
      await db.auth.admin.deleteUser(id).catch(() => {});
    }
  }
}

async function main() {
  if (!BASE_URL) return;
  console.log("LeetCode ownership verification integration tests\n");

  const memberA = await makeMember();
  const memberB = await makeMember();

  await check(
    "1. A signed-in user's own client cannot set leetcode_verified_at, insert into leetcode_verifications, or call claim_leetcode_handle",
    async () => {
      const { error: updateErr } = await memberA.client
        .from("profiles")
        .update({ leetcode_verified_at: new Date().toISOString() })
        .eq("id", memberA.id);
      assert(updateErr, "client update of leetcode_verified_at must error");

      const { error: insertErr } = await memberA.client
        .from("leetcode_verifications")
        .insert({
          user_id: memberA.id,
          handle: randomHandle(),
          code: "MY-ABC234",
          expires_at: new Date(Date.now() + 60000).toISOString(),
        });
      assert(insertErr, "client insert into leetcode_verifications must error");

      const { error: rpcErr } = await memberA.client.rpc("claim_leetcode_handle", {
        p_user_id: memberA.id,
        p_handle: randomHandle(),
      });
      assert(rpcErr, "client call to claim_leetcode_handle must error");
    }
  );

  const handleClaim = randomHandle();
  await check(
    "2. claim_leetcode_handle gives A handle verified, releases B who held it, and handle change clears verified_at",
    async () => {
      // Give B the handle first with stats
      await db.from("profiles").update({
        leetcode_username: handleClaim,
        total_easy: 5,
        total_medium: 10,
        total_hard: 2,
        contest_rating: 1550,
      }).eq("id", memberB.id);

      // Also insert a pending verification code for A to verify claim_leetcode_handle deletes it
      await db.from("leetcode_verifications").upsert({
        user_id: memberA.id,
        handle: handleClaim,
        code: "MY-AAAAAA",
        expires_at: new Date(Date.now() + 60000).toISOString(),
      });

      const { data: released, error: claimErr } = await db.rpc("claim_leetcode_handle", {
        p_user_id: memberA.id,
        p_handle: handleClaim,
      });
      assert(!claimErr, `claim_leetcode_handle error: ${claimErr?.message}`);
      assert(released === 1, `expected released = 1, got ${released}`);

      // Check A
      const { data: profA } = await db
        .from("profiles")
        .select("leetcode_username, leetcode_verified_at")
        .eq("id", memberA.id)
        .single();
      assert(profA.leetcode_username === handleClaim.toLowerCase(), `expected A handle ${handleClaim.toLowerCase()}, got ${profA.leetcode_username}`);
      assert(profA.leetcode_verified_at != null, "expected A leetcode_verified_at to be set");

      // Check B
      const { data: profB } = await db
        .from("profiles")
        .select("leetcode_username, total_easy, total_medium, total_hard, contest_rating")
        .eq("id", memberB.id)
        .single();
      assert(profB.leetcode_username === null, `expected B handle null, got ${profB.leetcode_username}`);
      assert(profB.total_easy === 0, `expected B total_easy 0, got ${profB.total_easy}`);
      assert(profB.total_medium === 0, `expected B total_medium 0, got ${profB.total_medium}`);
      assert(profB.total_hard === 0, `expected B total_hard 0, got ${profB.total_hard}`);
      assert(profB.contest_rating === null, `expected B contest_rating null, got ${profB.contest_rating}`);

      // Check pending code deleted
      const { data: pendingA } = await db.from("leetcode_verifications").select("*").eq("user_id", memberA.id);
      assert(pendingA.length === 0, `expected pending code deleted, found ${pendingA.length}`);

      // Later service update of A's handle clears leetcode_verified_at
      const newHandleA = randomHandle();
      await db.from("profiles").update({ leetcode_username: newHandleA }).eq("id", memberA.id);
      const { data: profA2 } = await db
        .from("profiles")
        .select("leetcode_username, leetcode_verified_at")
        .eq("id", memberA.id)
        .single();
      assert(profA2.leetcode_username === newHandleA.toLowerCase(), "A handle update failed");
      assert(profA2.leetcode_verified_at === null, "expected A leetcode_verified_at to be cleared on handle change");
    }
  );

  await check(
    "3. mark_solved_from_leetcode: unverified handle imports as 'self' without promoting attempted; verified imports as 'leetcode' and promotes",
    async () => {
      const { data: probs } = await db.from("problems").select("title_slug").eq("paid_only", false).limit(2);
      const slug1 = probs[0].title_slug;
      const slug2 = probs[1].title_slug;

      // Ensure memberA has unverified handle
      await db.from("profiles").update({ leetcode_username: randomHandle(), leetcode_verified_at: null }).eq("id", memberA.id);

      // Pre-insert slug1 as attempted
      await db.from("user_problem_status").upsert({
        user_id: memberA.id,
        problem_slug: slug1,
        status: "attempted",
        solved_at: new Date().toISOString(),
      });

      // Call mark_solved_from_leetcode with slug1 (already attempted) and slug2 (fresh)
      await db.rpc("mark_solved_from_leetcode", {
        p_user_id: memberA.id,
        p_slugs: [slug1, slug2],
      });

      // Check slug1 is still attempted
      const { data: status1 } = await db.from("user_problem_status").select("status").eq("user_id", memberA.id).eq("problem_slug", slug1).single();
      assert(status1.status === "attempted", `expected slug1 to stay attempted, got ${status1.status}`);

      // Check slug2 was inserted as solved and problem_event has source 'self'
      const { data: status2 } = await db.from("user_problem_status").select("status").eq("user_id", memberA.id).eq("problem_slug", slug2).single();
      assert(status2.status === "solved", `expected slug2 to be solved, got ${status2.status}`);

      const { data: ev2 } = await db.from("problem_events").select("metadata").eq("user_id", memberA.id).eq("problem_slug", slug2).eq("kind", "solved").single();
      assert(ev2?.metadata?.source === "self", `expected event source 'self', got ${ev2?.metadata?.source}`);

      // Now verify memberA
      await db.from("profiles").update({ leetcode_verified_at: new Date().toISOString() }).eq("id", memberA.id);

      // Call mark_solved_from_leetcode with slug1 now that handle is verified
      await db.rpc("mark_solved_from_leetcode", {
        p_user_id: memberA.id,
        p_slugs: [slug1],
      });

      // Check slug1 is now solved
      const { data: status1Verified } = await db.from("user_problem_status").select("status").eq("user_id", memberA.id).eq("problem_slug", slug1).single();
      assert(status1Verified.status === "solved", `expected slug1 to become solved, got ${status1Verified.status}`);

      const { data: ev1 } = await db.from("problem_events").select("metadata").eq("user_id", memberA.id).eq("problem_slug", slug1).eq("kind", "solved").single();
      assert(ev1?.metadata?.source === "leetcode", `expected event source 'leetcode', got ${ev1?.metadata?.source}`);
    }
  );

  await check(
    "4. Client inserting problem_events with source 'leetcode' downgrades to 'self'; updating battle evidence to 'leetcode' leaves 'none'",
    async () => {
      const testSlug = `test-slug-${Date.now()}`;
      const { data: ev, error: evErr } = await memberA.client
        .from("problem_events")
        .insert({
          user_id: memberA.id,
          problem_slug: testSlug,
          kind: "solved",
          metadata: { source: "leetcode" },
        })
        .select("metadata")
        .single();
      assert(!evErr, `problem_events insert error: ${evErr?.message}`);
      assert(ev?.metadata?.source === "self", `expected source 'self', got ${ev?.metadata?.source}`);

      // Start a battle directly via db
      const { data: btl, error: btlErr } = await db
        .from("battles")
        .insert({
          user_id: memberA.id,
          problem_slug: testSlug,
          outcome: "in_progress",
          evidence: "none",
        })
        .select("id, evidence")
        .single();
      assert(!btlErr && btl, "failed to insert battle");
      made.battles.push(btl.id);

      // User client tries to update battle evidence to 'leetcode'
      const { error: updErr } = await memberA.client
        .from("battles")
        .update({ evidence: "leetcode" })
        .eq("id", btl.id);
      assert(!updErr, `battle update error: ${updErr?.message}`);

      const { data: btlAfter } = await db.from("battles").select("evidence").eq("id", btl.id).single();
      assert(btlAfter.evidence === "none", `expected evidence 'none', got ${btlAfter.evidence}`);
    }
  );

  await check(
    "5. API: POST /api/battles end with evidence 'leetcode' leaves battle evidence 'none' and event source 'none'",
    async () => {
      const { data: prob } = await db.from("problems").select("title_slug").eq("paid_only", false).limit(1);
      const slug = prob[0].title_slug;

      const started = await postApi("/api/battles", memberA.token, { action: "start", problem_slug: slug });
      assert(started.body?.battle?.id, `start battle failed: ${started.status}`);
      const battleId = started.body.battle.id;
      made.battles.push(battleId);

      const ended = await postApi("/api/battles", memberA.token, {
        action: "end",
        battle_id: battleId,
        outcome: "solved",
        duration_sec: 300,
        evidence: "leetcode",
      });
      assert(ended.status === 200 && ended.body?.success === true, `end battle failed: ${ended.status}`);

      const { data: btl } = await db.from("battles").select("evidence").eq("id", battleId).single();
      assert(btl.evidence === "none", `expected battle evidence 'none', got ${btl.evidence}`);

      const { data: events } = await db.from("problem_events").select("metadata").eq("battle_id", battleId);
      assert(events && events.length === 1, `expected 1 problem event, got ${events?.length}`);
      assert(events[0].metadata?.source === "none", `expected event source 'none', got ${events[0].metadata?.source}`);
    }
  );

  await check(
    "6. API: POST /api/battles/verify for linked unverified handle returns { linked: true, verified: false }",
    async () => {
      const handleUnverified = randomHandle();
      await db.from("profiles").update({
        leetcode_username: handleUnverified,
        leetcode_verified_at: null,
      }).eq("id", memberA.id);

      const { data: prob } = await db.from("problems").select("title_slug").eq("paid_only", false).limit(1);
      const slug = prob[0].title_slug;

      const started = await postApi("/api/battles", memberA.token, { action: "start", problem_slug: slug });
      assert(started.body?.battle?.id, `start battle failed: ${started.status}`);
      const battleId = started.body.battle.id;
      made.battles.push(battleId);

      const verifyRes = await postApi("/api/battles/verify", memberA.token, { battle_id: battleId });
      assert(verifyRes.status === 200, `verify failed with status ${verifyRes.status}`);
      assert(verifyRes.body?.linked === true, `expected linked: true, got ${verifyRes.body?.linked}`);
      assert(verifyRes.body?.verified === false, `expected verified: false, got ${verifyRes.body?.verified}`);
      assert(verifyRes.body?.username === handleUnverified.toLowerCase(), `expected username ${handleUnverified.toLowerCase()}, got ${verifyRes.body?.username}`);
    }
  );

  await check(
    "7. API: /api/leetcode/verify invalid start -> 400, check with no row -> 404, check with expired row -> 410",
    async () => {
      const invalidStart = await postApi("/api/leetcode/verify", memberA.token, { action: "start", handle: "not a handle!" });
      assert(invalidStart.status === 400, `expected 400, got ${invalidStart.status}`);

      // Ensure memberA has no row in leetcode_verifications
      await db.from("leetcode_verifications").delete().eq("user_id", memberA.id);

      const noRowCheck = await postApi("/api/leetcode/verify", memberA.token, { action: "check" });
      assert(noRowCheck.status === 404, `expected 404, got ${noRowCheck.status}`);

      // Insert an expired row. Member B checks it: Check allows one call per
      // 8 seconds per user, and A just used theirs.
      await db.from("leetcode_verifications").insert({
        user_id: memberB.id,
        handle: randomHandle(),
        code: "MY-EXPIRE",
        expires_at: new Date(Date.now() - 60000).toISOString(),
      });

      const expiredCheck = await postApi("/api/leetcode/verify", memberB.token, { action: "check" });
      assert(expiredCheck.status === 410, `expected 410, got ${expiredCheck.status}`);
    }
  );

  await check(
    "8. API: POST /api/sync/leetcode as A with B's handle -> 403 with code 'handle_taken'",
    async () => {
      const handleB = randomHandle();
      await db.from("profiles").update({ leetcode_username: handleB }).eq("id", memberB.id);

      const syncRes = await postApi("/api/sync/leetcode", memberA.token, { username: handleB });
      assert(syncRes.status === 403, `expected 403, got ${syncRes.status}`);
      assert(syncRes.body?.code === "handle_taken", `expected code: 'handle_taken', got ${syncRes.body?.code}`);
      assert(syncRes.body?.handle === handleB.toLowerCase(), `expected handle: ${handleB.toLowerCase()}, got ${syncRes.body?.handle}`);
    }
  );

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(`\nharness error: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
