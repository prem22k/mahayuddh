/**
 * Database policy regressions — RUNS AGAINST THE LOCAL DATABASE.
 *
 * Each block below is a hole the 2026-11-16 audit found (migration
 * 20261117000000_security_fixes.sql). Every case checks both halves: the
 * attack is refused, and the thing the app really does still works. A fix that
 * only blocks is how a signup flow or an accept button breaks silently.
 *
 * Signs in real users with the publishable key, so policies, grants and
 * triggers all apply exactly as they do for the browser.
 *
 * Run: npm run test:integration:policies
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
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const db = createClient(URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anon = createClient(URL, anonKey, { auth: { persistSession: false } });

const tag = `xpol${Date.now()}`.slice(0, 20);
const made = { users: [], squads: [] };

let pass = 0, fail = 0;
function ok(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond && detail) console.log(`        ${detail}`);
  cond ? pass++ : fail++;
}

async function authUser(i) {
  const email = `${tag}_${i}@example.com`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  const cli = createClient(URL, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await cli.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  return { id: data.user.id, cli };
}

async function withProfile(i) {
  const u = await authUser(i);
  const { error } = await db.from("profiles").insert({ id: u.id, username: `${tag}_${i}` });
  if (error) throw new Error(`profile: ${error.message}`);
  return u;
}

async function squadOf(owner, n) {
  const { data, error } = await db.from("squads")
    .insert({ name: `${tag} squad ${n}`, created_by: owner.id, invite_code: `${tag}${n}`.slice(-8).toUpperCase() })
    .select("id, invite_code").single();
  if (error) throw new Error(`squad: ${error.message}`);
  made.squads.push(data.id);
  await db.from("squad_members").insert({ squad_id: data.id, user_id: owner.id, role: "admin" });
  return data;
}

async function cleanup() {
  for (const id of made.squads) await db.from("squads").delete().eq("id", id);
  for (const id of made.users) {
    await db.from("profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id);
  }
}

try {
  // ── 1. Profile creation keeps only id, username, avatar ───────────────────
  const fresh = await authUser("fresh");
  const { error: insErr } = await fresh.cli.from("profiles").insert({
    id: fresh.id, username: `${tag}_fresh`, avatar_url: null,
    is_product_admin: true, streak: 999, total_hard: 9999, contest_rating: 3500,
    leetcode_username: `${tag}lc`, invited_by: fresh.id,
  });
  ok("a signup can still create its own profile (the app's insert)", !insErr, insErr?.message);
  const { data: freshRow } = await db.from("profiles")
    .select("username, is_product_admin, streak, total_hard, contest_rating, leetcode_username, invited_by")
    .eq("id", fresh.id).single();
  ok("its username is kept", freshRow?.username === `${tag}_fresh`);
  ok("but it cannot make itself product admin", freshRow?.is_product_admin === false);
  ok("or forge streak, hard total and rating",
    freshRow?.streak === 0 && freshRow?.total_hard === 0 && freshRow?.contest_rating === null);
  ok("or claim a LeetCode handle or referral credit",
    freshRow?.leetcode_username === null && freshRow?.invited_by === null);

  const a = await withProfile("a");
  const b = await withProfile("b");
  const s1 = await squadOf(a, 1); // a's squad
  const s2 = await squadOf(b, 2); // b's squad; a is not a member

  // ── 2. Goals, seasons, recaps stay inside your own squad ──────────────────
  const { error: g2 } = await a.cli.from("squad_goals").insert({ squad_id: s2.id, title: "hijack", target_count: 5 });
  ok("a cannot create a goal in a squad they are not in", !!g2);
  const { error: g1 } = await a.cli.from("squad_goals").insert({ squad_id: s1.id, title: "ours", target_count: 5 });
  ok("a can still create a goal in their own squad", !g1, g1?.message);

  const { data: bGoal } = await db.from("squad_goals").insert({ squad_id: s2.id, title: "b's goal", target_count: 5 }).select("id").single();
  await a.cli.from("squad_goals").update({ title: "vandalised" }).eq("id", bGoal.id);
  await a.cli.from("squad_goals").delete().eq("id", bGoal.id);
  const { data: bGoalAfter } = await db.from("squad_goals").select("title").eq("id", bGoal.id).maybeSingle();
  ok("a cannot edit or delete another squad's goal", bGoalAfter?.title === "b's goal");

  const { error: se2 } = await a.cli.from("squad_seasons").insert({ squad_id: s2.id, name: "hijack" });
  ok("a cannot start a season in another squad", !!se2);
  const { error: se1 } = await a.cli.from("squad_seasons").insert({ squad_id: s1.id, name: "ours" });
  ok("a can still start a season in their own squad", !se1, se1?.message);

  const week = { week_start: "2026-11-09", week_end: "2026-11-15" };
  const { error: r2 } = await a.cli.from("squad_recaps").insert({ squad_id: s2.id, ...week, generated_by: a.id });
  ok("a cannot post a recap into another squad", !!r2);
  const { error: r1 } = await a.cli.from("squad_recaps").insert({ squad_id: s1.id, ...week, generated_by: a.id });
  ok("a can still post their own squad's recap", !r1, r1?.message);

  // ── 3. Invite codes are for members only ──────────────────────────────────
  const { error: anonCode } = await anon.from("squads").select("id, invite_code").eq("id", s1.id);
  ok("a signed-out visitor cannot read invite codes", !!anonCode);
  const { data: anonName, error: anonNameErr } = await anon.from("squads").select("id, name").eq("id", s1.id);
  ok("but can still read a squad's name", !anonNameErr && anonName?.length === 1, anonNameErr?.message);
  const { error: aCode } = await a.cli.from("squads").select("invite_code").eq("id", s2.id);
  ok("a signed-in non-member cannot read a squad's code", !!aCode);
  const { data: myCodes, error: myCodesErr } = await a.cli.rpc("my_squad_invite_codes");
  ok("a member gets their own squad's code", !myCodesErr && myCodes?.some((r) => r.squad_id === s1.id && r.invite_code === s1.invite_code), myCodesErr?.message);
  ok("and only their own squads' codes", !myCodes?.some((r) => r.squad_id === s2.id));

  // ── 4. A note editor edits the note, not who owns or sees it ──────────────
  const { data: note } = await db.from("notebook_notes")
    .insert({ owner_id: a.id, title: "private", body_md: "x", visibility: "private" }).select("id").single();
  await db.from("note_shares").insert({ note_id: note.id, shared_with: b.id, can_edit: true });
  const { data: edited, error: editErr } = await b.cli.from("notebook_notes").update({ title: "edited" }).eq("id", note.id).select("id");
  ok("an editor can still edit a shared note", !editErr && edited?.length === 1, editErr?.message);
  const { error: steal } = await b.cli.from("notebook_notes").update({ owner_id: b.id }).eq("id", note.id);
  ok("an editor cannot take ownership", !!steal);
  const { error: publish } = await b.cli.from("notebook_notes").update({ visibility: "public" }).eq("id", note.id);
  ok("an editor cannot make the note public", !!publish);
  const { error: ownerVis } = await a.cli.from("notebook_notes").update({ visibility: "squad" }).eq("id", note.id);
  ok("the owner can still change who sees it", !ownerVis, ownerVis?.message);

  // ── 5a. Only the challenged person completes a challenge, after solving ───
  const { data: ch } = await db.from("suggestions").insert({
    from_user: a.id, to_user: b.id, problem_slug: "two-sum", problem_title: "Two Sum", difficulty: "Easy",
  }).select("id").single();
  const { error: senderDone } = await a.cli.from("suggestions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", ch.id);
  ok("the sender cannot mark their own challenge completed", !!senderDone);
  const { error: unsolvedDone } = await b.cli.from("suggestions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", ch.id);
  ok("the recipient cannot complete it before solving", !!unsolvedDone);
  await db.from("user_problem_status").insert({ user_id: b.id, problem_slug: "two-sum", status: "solved" });
  const { data: doneRows, error: doneErr } = await b.cli.from("suggestions")
    .update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", ch.id).eq("status", "pending").select("id");
  ok("the recipient completes it once solved (the app's path)", !doneErr && doneRows?.length === 1, doneErr?.message);
  const { data: ch2 } = await db.from("suggestions").insert({
    from_user: a.id, to_user: b.id, problem_slug: "valid-anagram", problem_title: "Valid Anagram", difficulty: "Easy",
  }).select("id").single();
  const { error: dismissErr } = await b.cli.from("suggestions").update({ status: "dismissed" }).eq("id", ch2.id);
  ok("dismissing a challenge still works", !dismissErr, dismissErr?.message);

  // ── 5b. Only the asker accepts a stuck answer; levels are fixed ───────────
  const { data: req } = await db.from("stuck_requests")
    .insert({ user_id: a.id, problem_slug: "two-sum", level: "pattern" }).select("id").single();
  const { data: reply } = await db.from("stuck_replies")
    .insert({ request_id: req.id, author_id: b.id, level: "nudge", body_md: "try a hash map" }).select("id").single();
  const { error: selfAccept } = await b.cli.from("stuck_replies").update({ accepted: true }).eq("id", reply.id);
  ok("a reply's author cannot accept their own answer", !!selfAccept);
  const { error: levelUp } = await b.cli.from("stuck_replies").update({ level: "full" }).eq("id", reply.id);
  ok("a reply's help level cannot be raised after the ladder check", !!levelUp);
  const { error: askerAccept } = await a.cli.from("stuck_replies").update({ accepted: true }).eq("id", reply.id).eq("request_id", req.id);
  ok("the asker can still accept it (the app's path)", !askerAccept, askerAccept?.message);

  // ── 5c. Squad feed events and discussions come from members ───────────────
  const { error: fe2 } = await a.cli.from("feed_events").insert({ user_id: a.id, event_type: "solve", squad_id: s2.id });
  ok("a cannot post into another squad's feed", !!fe2);
  const { error: fe1 } = await a.cli.from("feed_events").insert({ user_id: a.id, event_type: "solve", squad_id: s1.id });
  ok("a can still post into their own squad's feed", !fe1, fe1?.message);
  const { error: feG } = await a.cli.from("feed_events").insert({ user_id: a.id, event_type: "solve", squad_id: null });
  ok("and a squadless event still works", !feG, feG?.message);

  const post = { author_id: a.id, problem_slug: "two-sum", pattern_tags: ["Arrays"], body_md: "Tried sorting. Try a hash map.", visibility: "squad" };
  const { error: d2 } = await a.cli.from("discussions").insert({ ...post, squad_id: s2.id });
  ok("a cannot start a discussion inside another squad", !!d2);
  const { error: d1 } = await a.cli.from("discussions").insert({ ...post, squad_id: s1.id });
  ok("a can still start one in their own squad", !d1, d1?.message);

  // ── 6. content_impact no longer lists forks inside private notes ──────────
  const { data: appr } = await db.from("approaches")
    .insert({ user_id: a.id, problem_slug: "two-sum", core_idea: "hash map", visibility: "public" }).select("id").single();
  await db.from("notebook_notes").insert({
    owner_id: b.id, title: "my fork", body_md: "x", visibility: "private", fork_of: appr.id, fork_of_type: "approach",
  });
  const { data: seenByAnon } = await anon.from("content_impact").select("forker_id").eq("source_id", appr.id);
  ok("a stranger cannot see a fork made into a private note", (seenByAnon ?? []).length === 0);
  const { data: seenByOwner } = await b.cli.from("content_impact").select("forker_id").eq("source_id", appr.id);
  ok("the forker still sees their own", (seenByOwner ?? []).length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);
