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
  await db.from("squads").update({ visibility: "public" }).eq("id", s2.id);
  const { data: anonName, error: anonNameErr } = await anon.from("squads").select("id, name").eq("id", s2.id);
  ok("but can still read a public squad's name", !anonNameErr && anonName?.length === 1, anonNameErr?.message);
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

  // ── 7. Private squads show outsiders their name and rank, nothing else ────
  // s1 (a's) is private by default; s2 (b's) was made public above.
  const priv = s1.id, pub = s2.id;
  const outsider = b; // a member of s2 only
  for (const [table, col] of [["squads", "id"], ["squad_members", "squad_id"], ["squad_goals", "squad_id"], ["squad_seasons", "squad_id"], ["squad_recaps", "squad_id"]]) {
    const { data: asAnon } = await anon.from(table).select(col).eq(col, priv);
    const { data: asOutsider } = await outsider.cli.from(table).select(col).eq(col, priv);
    const { data: asMember } = await a.cli.from(table).select(col).eq(col, priv);
    ok(`private squad: ${table} hidden from signed-out visitors and outsiders, shown to members`,
      (asAnon ?? []).length === 0 && (asOutsider ?? []).length === 0 && (asMember ?? []).length > 0,
      `anon ${(asAnon ?? []).length}, outsider ${(asOutsider ?? []).length}, member ${(asMember ?? []).length}`);
  }
  const { data: pubMembers } = await anon.from("squad_members").select("user_id").eq("squad_id", pub);
  ok("public squad: anyone can see who is in it", (pubMembers ?? []).length === 1);

  // Squad leaderboard: verified solves per member. s1: a + c, 3 verified solves -> 1.5.
  const c = await withProfile("c");
  await db.from("squad_members").insert({ squad_id: priv, user_id: c.id, role: "member" });
  const verified = (uid, slug) => ({ user_id: uid, problem_slug: slug, kind: "solved", metadata: { source: "leetcode" } });
  await db.from("problem_events").insert([verified(a.id, "two-sum"), verified(a.id, "valid-anagram"), verified(c.id, "two-sum"), verified(b.id, "two-sum")]);
  const { data: boardAnon } = await anon.rpc("squad_leaderboard", { p_window: "week", p_limit: 100, p_offset: 0 });
  // Outsiders get no id for a private squad, so find it by name.
  const privRow = (boardAnon ?? []).find((r) => r.name === `${tag} squad 1`);
  const pubRow = (boardAnon ?? []).find((r) => r.squad_id === pub);
  ok("a private squad still appears on the squad board by name", privRow?.name === `${tag} squad 1`);
  ok("ranked by verified solves per member (3 solves / 2 members = 1.5)", Number(privRow?.value) === 1.5, String(privRow?.value));
  ok("but outsiders do not learn its size", privRow?.member_count === null && privRow?.is_public === false);
  ok("a public squad shows its size", pubRow?.member_count === 1 && Number(pubRow?.value) === 1);
  ok("ranked higher average first", privRow && pubRow && privRow.rank < pubRow.rank);
  const { data: boardMember } = await a.cli.rpc("squad_leaderboard", { p_window: "week", p_limit: 100, p_offset: 0 });
  const mine = (boardMember ?? []).find((r) => r.squad_id === priv);
  ok("members see their own private squad's size and that it is theirs", mine?.is_mine === true && mine?.member_count === 2);

  // Only an admin changes who can see the squad.
  const { error: memberFlip } = await c.cli.rpc("set_squad_visibility", { p_squad: priv, p_visibility: "public" });
  ok("a squad member who is not an admin cannot make it public", !!memberFlip);
  const { error: outsiderFlip } = await outsider.cli.rpc("set_squad_visibility", { p_squad: priv, p_visibility: "public" });
  ok("an outsider cannot make it public", !!outsiderFlip);
  const { error: anonFlip } = await anon.rpc("set_squad_visibility", { p_squad: priv, p_visibility: "public" });
  ok("a signed-out visitor cannot make it public", !!anonFlip);
  const { error: directFlip } = await c.cli.from("squads").update({ visibility: "public" }).eq("id", priv);
  const { data: stillPrivate } = await db.from("squads").select("visibility").eq("id", priv).single();
  ok("nor by writing the column directly", stillPrivate?.visibility === "private", directFlip?.message);
  const { error: adminFlip } = await a.cli.rpc("set_squad_visibility", { p_squad: priv, p_visibility: "public" });
  const { data: nowPublic } = await anon.from("squad_members").select("user_id").eq("squad_id", priv);
  ok("the admin can make it public, and then anyone sees its members", !adminFlip && (nowPublic ?? []).length === 2, adminFlip?.message);
  await a.cli.rpc("set_squad_visibility", { p_squad: priv, p_visibility: "private" });
  await db.from("problem_events").delete().in("user_id", [a.id, b.id, c.id]);

  // ── 8. Review follow-ups: no roster leaks through the leaderboard ─────────
  // Squad board: the caller must be in the squad their active_squad_id names.
  const lone = await withProfile("lone");
  await db.from("profiles").update({ active_squad_id: priv }).eq("id", lone.id); // stale pointer, not a member
  const { data: staleBoard } = await lone.cli.rpc("leaderboard", { p_scope: "squad", p_metric: "solves", p_window: "all" });
  ok("a stale active squad shows nothing, not that squad's roster", (staleBoard ?? []).length === 0, `${(staleBoard ?? []).length} rows`);
  const { data: emptySquad } = await db.from("squads").insert({ name: `${tag} empty`, created_by: lone.id, invite_code: `${tag}E`.slice(-8).toUpperCase() }).select("id").single();
  made.squads.push(emptySquad.id);
  await db.from("profiles").update({ active_squad_id: emptySquad.id }).eq("id", lone.id);
  const { data: emptyBoard } = await lone.cli.rpc("leaderboard", { p_scope: "squad", p_metric: "solves", p_window: "all" });
  ok("an empty squad's board is empty, not the global board", (emptyBoard ?? []).length === 0, `${(emptyBoard ?? []).length} rows`);
  const { data: wild } = await anon.rpc("leaderboard", { p_scope: "global", p_metric: "pattern", p_window: "all", p_pattern: "%" });
  ok("'%' as a pattern is literal, not a match-everything wildcard", (wild ?? []).length === 0, `${(wild ?? []).length} rows`);

  // Squad board hides a private squad's id from outsiders; bad window = nothing.
  const { data: sb } = await anon.rpc("squad_leaderboard", { p_window: "all", p_limit: 100, p_offset: 0 });
  ok("the squad board gives outsiders no id for a private squad", (sb ?? []).filter((r) => !r.is_public && !r.is_mine).every((r) => r.squad_id === null));
  const { data: sbMine } = await a.cli.rpc("squad_leaderboard", { p_window: "all", p_limit: 100, p_offset: 0 });
  ok("but members get their own squad's id", (sbMine ?? []).some((r) => r.is_mine && r.squad_id === priv));
  const { data: sbBad } = await anon.rpc("squad_leaderboard", { p_window: "bogus", p_limit: 100, p_offset: 0 });
  ok("an unknown window returns nothing", (sbBad ?? []).length === 0);

  // Rank history of a private squad is for its members.
  const today = new Date().toISOString().slice(0, 10);
  await db.from("leaderboard_snapshots").insert([
    { scope: `squad:${priv}`, metric: "solves:week", user_id: a.id, rank: 1, value: 2, snapshot_date: today },
    { scope: "global", metric: `${tag}:week`, user_id: a.id, rank: 1, value: 2, snapshot_date: today },
  ]);
  const { data: snapAnon } = await anon.from("leaderboard_snapshots").select("user_id").eq("scope", `squad:${priv}`);
  const { data: snapOut } = await outsider.cli.from("leaderboard_snapshots").select("user_id").eq("scope", `squad:${priv}`);
  const { data: snapMem } = await a.cli.from("leaderboard_snapshots").select("user_id").eq("scope", `squad:${priv}`);
  ok("a private squad's rank history is hidden from outsiders and signed-out visitors",
    (snapAnon ?? []).length === 0 && (snapOut ?? []).length === 0, `anon ${(snapAnon ?? []).length}, outsider ${(snapOut ?? []).length}`);
  ok("and shown to its members", (snapMem ?? []).length === 1);
  const { data: snapGlobal } = await anon.from("leaderboard_snapshots").select("user_id").eq("metric", `${tag}:week`);
  ok("global rank history stays public", (snapGlobal ?? []).length === 1);
  await db.from("leaderboard_snapshots").delete().in("scope", [`squad:${priv}`]);
  await db.from("leaderboard_snapshots").delete().eq("metric", `${tag}:week`);

  // The snapshot route only freezes a squad the caller is in, with its members.
  const BASE = process.env.BASE_URL || env.BASE_URL || "http://localhost:3000";
  const serverUp = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok).catch(() => false);
  if (serverUp) {
    const tokenOf = async (u) => (await u.cli.auth.getSession()).data.session.access_token;
    const post = async (u, body) => (await fetch(`${BASE}/api/leaderboard/snapshot`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenOf(u)}` },
      body: JSON.stringify(body),
    })).status;
    ok("snapshot route: an outsider cannot freeze another squad's board",
      (await post(outsider, { scope: `squad:${priv}`, metric: "solves:week", rows: [{ user_id: outsider.id, rank: 1, value: 9 }] })) === 403);
    ok("snapshot route: a member cannot slip a non-member into the board",
      (await post(a, { scope: `squad:${priv}`, metric: "solves:week", rows: [{ user_id: outsider.id, rank: 1, value: 9 }] })) === 400);
    ok("snapshot route: a made-up metric is refused",
      (await post(a, { scope: `squad:${priv}`, metric: "anything:goes", rows: [{ user_id: a.id, rank: 1, value: 1 }] })) === 400);
    ok("snapshot route: a member freezes their own squad's board",
      (await post(a, { scope: `squad:${priv}`, metric: "solves:week", rows: [{ user_id: a.id, rank: 1, value: 2 }, { user_id: c.id, rank: 2, value: 1 }] })) === 200);
    await db.from("leaderboard_snapshots").delete().eq("scope", `squad:${priv}`);
  } else {
    console.log("SKIP  snapshot route checks (no server at BASE_URL)");
  }

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
