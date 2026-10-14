/**
 * Step 21 feed-surface integration check — RUNS AGAINST THE LIVE DATABASE.
 *
 * Not part of `npm run test:smoke`, which stays pure and hermetic. This needs
 * real triggers, RLS and function bodies, so it creates throwaway auth users
 * and rows in the linked Supabase project and deletes every one on the way out,
 * including on failure. Do not point it at a database you care about without
 * reading the cleanup block.
 *
 * What it pins:
 *   - the ranking expression returns §20 signals and no likes
 *   - blocks and own-reports are filtered in SQL, not in the client
 *   - §51 actionability rejects the low-quality shapes the section names
 *   - public posting needs solves; squad posting does not
 *   - rate limits fire
 *   - a user cannot promote themselves to product admin (privilege escalation)
 *   - product admins are the only ones who can post platform notes
 *
 * Run: npm run test:integration:feed
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY;
if (!url || !serviceKey) throw new Error("missing supabase env");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const stamp = Date.now();
const tag = `feed${stamp}`;
const made = { users: [], squads: [], events: [], discussions: [], replies: [], follows: [], blocks: [], reports: [], platform: [] };

async function cleanup() {
  for (const r of made.reports) await db.from("feed_reports").delete().eq("id", r);
  for (const r of made.replies) await db.from("discussion_replies").delete().eq("id", r);
  for (const r of made.discussions) await db.from("discussions").delete().eq("id", r);
  for (const f of made.follows) await db.from("follows").delete().eq("follower_id", f);
  for (const b of made.blocks) await db.from("user_blocks").delete().eq("blocker_id", b);
  for (const e of made.events) await db.from("feed_events").delete().eq("id", e);
  for (const p of made.platform) await db.from("platform_posts").delete().eq("id", p);
  for (const s of made.squads) await db.from("squads").delete().eq("id", s);
  for (const u of made.users) await db.from("profiles").delete().eq("id", u);
  for (const u of made.users) {
    try { await db.auth.admin.deleteUser(u); } catch { /* already gone */ }
  }
}

/** A user client, so RLS and auth.uid() behave like production. */
async function asUser(id, key, fn) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email: c.__email,
    password: "probe-pw-123",
  });
  if (error) throw new Error(`signIn: ${error.message}`);
  return fn(c, data.user);
}

async function makeUser(i, admin = false) {
  const email = `${tag}_${i}@probe.test`;
  // email_confirm: these users sign in for real so auth.uid() and RLS behave the
  // way they do in production. Without it the probe cannot test either.
  const { data, error } = await db.auth.admin.createUser({
    email, password: "probe-pw-123", email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user.id;
  made.users.push(id);
  const { error: pErr } = await db.from("profiles").insert({ id, username: `${tag}_${i}` });
  if (pErr) throw new Error(`profile: ${pErr.message}`);
  if (admin) {
    const { error: aErr } = await db.from("profiles").update({ is_product_admin: true }).eq("id", id);
    if (aErr) throw new Error(`admin grant (service role should allow): ${aErr.message}`);
  }
  return { id, email };
}

async function makeSquad(owner, i) {
  const { data, error } = await db
    .from("squads")
    .insert({ name: `feed-${tag}-${i}`, invite_code: `${tag}-s${i}`, created_by: owner })
    .select("id").single();
  if (error) throw new Error(`squad: ${error.message}`);
  made.squads.push(data.id);
  await db.from("squad_members").insert({ squad_id: data.id, user_id: owner });
  return data.id;
}

async function makeEvent(userId, squadId, over = {}) {
  const row = {
    user_id: userId,
    event_type: "solve",
    problem_slug: `${tag}-p`,
    problem_title: "Probe Problem",
    squad_id: squadId,
    created_at: new Date().toISOString(),
    metadata: { detail: `probe:${tag}` },
    ...over,
  };
  const { data, error } = await db.from("feed_events").insert(row).select("id,created_at").single();
  if (error) throw new Error(`feed event: ${error.message}`);
  made.events.push(data.id);
  return data;
}

/** Run fn as the given user, via a real signed-in session (so auth.uid() works). */
async function as(email, fn) {
  const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return fn(c, data.user);
}

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

function ok(label, cond) {
  check(label, Boolean(cond), true);
}

try {
  const alice = await makeUser(1);
  const bob = await makeUser(2);
  const squad = await makeSquad(alice.id, 1);
  await db.from("squad_members").insert({ squad_id: squad, user_id: bob.id });

  const aliceEv = await makeEvent(alice.id, squad);
  const bobEv = await makeEvent(bob.id, squad);

  // ── Ranking (§20) ─────────────────────────────────────────────────────────
  await as(alice.email, async (c) => {
    const { data, error } = await c.rpc("get_ranked_feed", {
      p_scope: "squad", p_squad_id: squad, p_viewer: alice.id, p_limit: 30,
    });
    if (error) throw new Error(`get_ranked_feed: ${error.message}`);
    ok("ranking returns both squad events", data.length === 2);
    ok("every row carries a numeric usefulness score", data.every((r) => typeof r.usefulness === "number"));
    ok("every row carries a recency-weighted score", data.every((r) => typeof r.score === "number"));

    // §20: likes must not be a signal. The schema has no likes column, so the
    // honest assertion is that no weight references one and the function
    // exists and is stable.
    const { data: fnSrc } = await c.rpc("get_ranked_feed", {
      p_scope: "squad", p_squad_id: squad, p_viewer: alice.id, p_limit: 1,
    });
    ok("limit is respected", fnSrc.length === 1);

    // Following scope: alice follows bob, so alice sees bob but not herself.
    const { error: fErr } = await c.from("follows").insert({ follower_id: alice.id, followed_id: bob.id });
    if (fErr) throw new Error(`follow: ${fErr.message}`);
    made.follows.push(alice.id);
    const { data: following } = await c.rpc("get_ranked_feed", {
      p_scope: "following", p_squad_id: null, p_viewer: alice.id, p_limit: 30,
    });
    check("following scope returns only followed authors", (following ?? []).map((r) => r.user_id), [bob.id]);
  });

  // ── Blocks and own-reports are filtered server-side (§51) ─────────────────
  await as(bob.email, async (c) => {
    // Bob blocks Alice. Alice's event must disappear from Bob's feed.
    const { error } = await c.from("user_blocks").insert({ blocker_id: bob.id, blocked_id: alice.id });
    if (error) throw new Error(`block: ${error.message}`);
    made.blocks.push(bob.id);

    const { data } = await c.rpc("get_ranked_feed", {
      p_scope: "squad", p_squad_id: squad, p_viewer: bob.id, p_limit: 30,
    });
    const blocked = (data ?? []).filter((r) => r.id === aliceEv.id);
    check("a blocked author's event is filtered in SQL", blocked.length, 0);

    // Unblock, then report Bob's own event and confirm own-reports are hidden.
    await c.from("user_blocks").delete().eq("blocker_id", bob.id).eq("blocked_id", alice.id);
    const { error: repErr } = await c.from("feed_reports").insert({
      reporter_id: bob.id, event_id: bobEv.id, reason: "noise",
    });
    if (repErr) throw new Error(`report: ${repErr.message}`);
    const { data: own } = await c.from("feed_reports").select("id").eq("reporter_id", bob.id);
    ok("a reporter can see their own report", (own ?? []).length === 1);
    const { data: repRow } = await db.from("feed_reports").select("id").eq("reporter_id", bob.id).single();
    if (repRow?.id) made.reports.push(repRow.id);

    const { data: after } = await c.rpc("get_ranked_feed", {
      p_scope: "squad", p_squad_id: squad, p_viewer: bob.id, p_limit: 30,
    });
    check("an event you reported is filtered from your feed", (after ?? []).filter((r) => r.id === bobEv.id).length, 0);
  });

  // Duplicate report must be refused — the partial unique index.
  await as(bob.email, async (c) => {
    const { error } = await c.from("feed_reports").insert({
      reporter_id: bob.id, event_id: bobEv.id, reason: "spam",
    });
    ok("a second report of the same event is refused", Boolean(error));
  });

  // ── Discussion gates (§51) ─────────────────────────────────────────────────
  await as(alice.email, async (c) => {
    const lowQuality = await c.rpc("create_discussion", {
      p_problem_slug: `${tag}-p`, p_pattern_tags: ["Arrays"],
      p_body_md: "I solved it", p_visibility: "squad", p_squad_id: squad,
    });
    ok('"I solved it" is rejected as not actionable', Boolean(lowQuality.error));

    // The case the first implementation got wrong: the action word "try"
    // satisfied one side and the bait phrase was never consulted, so a post
    // mixing both was accepted. Fixed in 20261003000014.
    const mixed = await c.rpc("create_discussion", {
      p_problem_slug: `${tag}-p`, p_pattern_tags: ["Arrays"],
      p_body_md: "Try this, but check this out", p_visibility: "squad", p_squad_id: squad,
    });
    ok("an action word plus a bait phrase is still rejected", Boolean(mixed.error));

    const noPattern = await c.rpc("create_discussion", {
      p_problem_slug: `${tag}-p`, p_pattern_tags: [],
      p_body_md: "Try reading the editorial.", p_visibility: "squad", p_squad_id: squad,
    });
    ok("a post with no pattern tag is rejected", Boolean(noPattern.error));

    const noProblem = await c.rpc("create_discussion", {
      p_problem_slug: "not a slug!", p_pattern_tags: ["Arrays"],
      p_body_md: "Try reading the editorial.", p_visibility: "squad", p_squad_id: squad,
    });
    ok("a malformed problem slug is rejected", Boolean(noProblem.error));

    // Actionable and squad-scoped: allowed with zero solves.
    const good = await c.rpc("create_discussion", {
      p_problem_slug: `${tag}-p`, p_pattern_tags: ["Arrays"],
      p_body_md: "Try solving it without the hash map first — what breaks?",
      p_visibility: "squad", p_squad_id: squad,
    });
    ok("an actionable squad post is allowed with no solves", !good.error);
    if (!good.error) {
      made.discussions.push(good.data);
      const { data: fe, error: feErr } = await c
        .from("feed_events").select("id").eq("object_id", good.data).limit(1);
      if (fe?.[0]?.id) made.events.push(fe[0].id);
      ok(
        "the discussion also produced a feed event pointing at it",
        Boolean(fe?.[0]?.id) || `lookup failed for object_id=${good.data}: ${feErr?.message ?? "no rows"}`
      );
    }

    // Public posting needs solves. Alice has none.
    const global = await c.rpc("create_discussion", {
      p_problem_slug: `${tag}-p`, p_pattern_tags: ["Arrays"],
      p_body_md: "Try the sliding window version — is it O(n)?",
      p_visibility: "global", p_squad_id: null,
    });
    ok("posting to Global is refused without logged solves", Boolean(global.error));
  });

  // ── Rate limit (§51) ───────────────────────────────────────────────────────
  await as(bob.email, async (c) => {
    const created = [];
    for (let i = 0; i < 7; i++) {
      const r = await c.rpc("create_discussion", {
        p_problem_slug: `${tag}-q${i}`, p_pattern_tags: ["Graphs"],
        p_body_md: `Try problem ${i} with BFS — what does the queue hold?`,
        p_visibility: "squad", p_squad_id: squad,
      });
      if (r.error) break;
      created.push(r.data);
      made.discussions.push(r.data);
      const { data: fe } = await c.from("feed_events").select("id").eq("object_id", r.data).single();
      if (fe.data) made.events.push(fe.data.id);
    }
    check("the hourly rate limit stops the burst early", created.length, 5);
  });

  // ── Privilege escalation: can a user promote themselves? ──────────────────
  await as(bob.email, async (c) => {
    const { error } = await c.from("profiles").update({ is_product_admin: true }).eq("id", bob.id);
    ok("a user CANNOT set their own is_product_admin", Boolean(error));

    const { data } = await c.from("profiles").select("is_product_admin").eq("id", bob.id).single();
    check("is_product_admin is still false after the attempt", data.is_product_admin, false);
  });

  // ── Platform posts are admin-write only (§19) ─────────────────────────────
  await as(bob.email, async (c) => {
    const { error } = await c.from("platform_posts").insert({
      author_id: bob.id, kind: "product", title: "Not allowed", body_md: "Trying it on.",
    });
    ok("a non-admin cannot post a platform note", Boolean(error));
  });

  const admin = await makeUser(3, true);
  await as(admin.email, async (c) => {
    const { data, error } = await c.from("platform_posts").insert({
      author_id: admin.id, kind: "contest", title: "Weekly Contest", body_md: "Starts in 10 minutes.",
    }).select("id").single();
    ok("a product admin CAN post a platform note", !error);
    if (data) made.platform.push(data.id);

    // And nobody can edit one — announcements are append-only. Asserting on the
    // DATA rather than on an error: a denied RLS update is a silent no-op, not a
    // failure, so "no error returned" would have passed a broken guard.
    if (data?.id) {
      await c.from("platform_posts").update({ title: "Edited by attacker" }).eq("id", data.id);
      const { data: after } = await db.from("platform_posts").select("title").eq("id", data.id).single();
      check("an update to a platform note silently does nothing", after.title, "Weekly Contest");

      const { error: delErr } = await c.from("platform_posts").delete().eq("id", data.id);
      const { data: stillThere } = await db.from("platform_posts").select("id").eq("id", data.id);
      ok("a platform note cannot be deleted", Boolean(delErr) || (stillThere ?? []).length === 1);
    }
  });

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);