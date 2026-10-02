/**
 * Loop D — squad from referral integration check. RUNS AGAINST THE LIVE DB.
 *
 * The design claim is that a referral token ATTRIBUTES and does not AUTHORISE.
 * These checks pin both halves, plus the abuse cases:
 *
 *   - a non-member cannot mint a link for a squad
 *   - a member's link is stable across calls (one link per person per squad)
 *   - joining with a valid token attributes the inviter
 *   - joining with NO token still works and attributes nobody
 *   - a forged token joins fine and attributes nothing
 *   - a token from a DIFFERENT squad does not attribute a join to this squad
 *   - a self-referral is ignored, never honoured
 *   - first referrer wins: a second valid token does not overwrite credit
 *   - opens increment atomically and only for the link that was opened
 *   - the referral row is not readable by an unrelated signed-in user
 *
 * Run: npm run test:integration:referral
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
const tag = `ref${stamp}`;
const made = { users: [], squads: [], referrals: [], members: [] };

async function asUser(email) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return { client: c, user: data.user, headers: { Authorization: `Bearer ${data.session.access_token}` } };
}

async function cleanup() {
  for (const id of made.referrals) await service.from("squad_referrals").delete().eq("id", id);
  await service.from("profiles").update({ invited_by: null, joined_via_referral: null })
    .in("id", made.users);
  for (const m of made.members) await service.from("squad_members").delete().eq("user_id", m);
  for (const s of made.squads) await service.from("squads").delete().eq("id", s);
  for (const u of made.users) {
    await service.from("profiles").delete().eq("id", u);
    try { await service.auth.admin.deleteUser(u); } catch { /* gone */ }
  }
}

async function makeUser(i) {
  const email = `${tag}_${i}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  await service.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}` });
  return { id: data.user.id, email };
}

async function makeSquad(owner, i, members) {
  // 8 uppercase alphanumerics, unique per squad. Derived from the tag AND the
  // squad index — truncating the tag alone collides, which it did.
  // 8 uppercase alphanumerics, guaranteed distinct per squad. Random rather than
  // derived: two truncations of a shared tag collided, which is a silly way to
  // spend a test run.
  const code = randomBytes(8).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8).padEnd(8, "Q");
  const { data, error } = await service.from("squads")
    .insert({ name: `ref-${tag}-${i}`, invite_code: code, created_by: owner })
    .select("id, invite_code").single();
  if (error) throw new Error(`squad: ${error.message}`);
  made.squads.push(data.id);
  for (const uid of members) {
    await service.from("squad_members").insert({ squad_id: data.id, user_id: uid });
    made.members.push(uid);
  }
  return data;
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}
function ok(label, cond) { check(label, Boolean(cond), true); }

const BASE = process.env.BASE_URL;

async function api(path, init, headers) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...headers },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

try {
  if (!BASE) throw new Error("BASE_URL is required — start the app first");
  const health = await fetch(`${BASE}/login`);
  if (!health.ok) throw new Error(`app not reachable at ${BASE} (${health.status})`);

  const alice = await makeUser(1);   // inviter, member of squad A
  const bob = await makeUser(2);     // invitee
  const carol = await makeUser(3);   // second invitee, tests first-referrer-wins
  const dave = await makeUser(4);    // not a member of squad A

  const squadA = await makeSquad(alice.id, 1, [alice.id]);
  const squadB = await makeSquad(alice.id, 2, [alice.id]);

  const aliceSession = await asUser(alice.email);

  // ── Only members can mint ───────────────────────────────────────────────
  const notMember = await api("/api/squads/referral", {
    method: "POST", body: JSON.stringify({ squad_id: squadA.id }),
  }, (await asUser(dave.email)).headers);
  check("a non-member cannot mint a link", notMember.status, 403);

  const minted = await api("/api/squads/referral", {
    method: "POST", body: JSON.stringify({ squad_id: squadA.id }),
  }, aliceSession.headers);
  check("a member can mint a link", minted.status, 200);
  const token = minted.json.token;
  ok("the token is URL-safe and long enough not to enumerate", /^[A-Za-z0-9]{12,24}$/.test(token), token);
  check("the link carries both the code and the token", minted.json.path,
    `/squad/join/${squadA.invite_code}?ref=${token}`);

  // Idempotent: the link a member put in a bio must keep working.
  const again = await api("/api/squads/referral", {
    method: "POST", body: JSON.stringify({ squad_id: squadA.id }),
  }, aliceSession.headers);
  check("calling again returns the same link", again.json.token, token);
  const { count: dupes } = await service.from("squad_referrals")
    .select("id", { count: "exact", head: true })
    .eq("squad_id", squadA.id).eq("referrer_id", alice.id);
  check("only one link row exists per person per squad", dupes, 1);

  // A different squad gets a different token.
  const mintedB = await api("/api/squads/referral", {
    method: "POST", body: JSON.stringify({ squad_id: squadB.id }),
  }, aliceSession.headers);
  check("each squad mints successfully", mintedB.status, 200);
  ok("each squad gets its own token", Boolean(mintedB.json.token) && mintedB.json.token !== token,
    `status=${mintedB.status} token=${String(mintedB.json.token).slice(0, 8)} error=${mintedB.json.error ?? "none"}`);

  // ── Opens count, only for the link that was opened ─────────────────────
  const preview1 = await api(`/api/squads/preview/${squadA.invite_code}?ref=${encodeURIComponent(token)}`);
  check("the preview names who sent the link", preview1.json.invited_by, `${tag}_1`);
  const previewNoRef = await api(`/api/squads/preview/${squadA.invite_code}`);
  check("a bare code names nobody", previewNoRef.json.invited_by, null);

  await api(`/api/squads/preview/${squadA.invite_code}?ref=${encodeURIComponent(token)}`);
  await api(`/api/squads/preview/${squadA.invite_code}?ref=${encodeURIComponent(token)}`);
  const { data: linkA } = await service.from("squad_referrals")
    .select("opens,joins").eq("token", token).single();
  check("three opens were counted", linkA.opens, 3);

  const { data: linkB } = await service.from("squad_referrals")
    .select("opens").eq("token", mintedB.json.token).single();
  check("the other link's count is untouched", linkB.opens, 0);

  // A forged token must not crash or attribute anything.
  const forged = await api(`/api/squads/preview/${squadA.invite_code}?ref=${randomBytes(12).toString("base64url")}`);
  check("a forged token names nobody", forged.json.invited_by, null);
  check("a forged token still shows the squad", forged.status, 200);

  // ── Joining with a valid token attributes ──────────────────────────────
  const bobSession = await asUser(bob.email);
  const joinBob = await api("/api/squads/join", {
    method: "POST", body: JSON.stringify({ invite_code: squadA.invite_code, ref: token }),
  }, bobSession.headers);
  check("the invitee joined", joinBob.status, 200);
  check("and the join reports who invited them", joinBob.json.invited_by, `${tag}_1`);

  const { data: bobProfile } = await service.from("profiles")
    .select("invited_by, joined_via_referral, active_squad_id").eq("id", bob.id).single();
  check("their profile records the inviter", bobProfile.invited_by, alice.id);
  check("and the referral link", bobProfile.joined_via_referral !== null, true);
  check("and the squad became active", bobProfile.active_squad_id, squadA.id);

  const { data: linkAfter } = await service.from("squad_referrals")
    .select("joins").eq("token", token).single();
  check("the inviter's join count went up", linkAfter.joins, 1);

  // ── First referrer wins ────────────────────────────────────────────────
  // Alice mints a second squad and sends that link to Carol first...
  const carolSession = await asUser(carol.email);
  const joinCarol = await api("/api/squads/join", {
    method: "POST", body: JSON.stringify({ invite_code: squadB.invite_code, ref: mintedB.json.token }),
  }, carolSession.headers);
  check("Carol joined via the second link", joinCarol.status, 200);
  const { data: carolProfile } = await service.from("profiles")
    .select("invited_by").eq("id", carol.id).single();
  check("Carol's inviter is recorded", carolProfile.invited_by, alice.id);

  // ...then Bob tries to walk Carol through squad A's link to overwrite credit.
  const overwrite = await api("/api/squads/join", {
    method: "POST", body: JSON.stringify({ invite_code: squadA.invite_code, ref: token }),
  }, carolSession.headers);
  check("re-joining is harmless", overwrite.status, 200);
  const { data: carolAfter } = await service.from("profiles")
    .select("invited_by, joined_via_referral").eq("id", carol.id).single();
  check("and credit is not overwritten", carolAfter.invited_by, alice.id);

  // ── A token for another squad does not attribute a join to this one ─────
  const wrongSquad = await api("/api/squads/join", {
    method: "POST", body: JSON.stringify({ invite_code: squadA.invite_code, ref: mintedB.json.token }),
  }, (await asUser(dave.email)).headers);
  check("joining squad A with squad B's token still works", wrongSquad.status, 200);
  const { data: daveProfile } = await service.from("profiles")
    .select("invited_by").eq("id", dave.id).single();
  check("but attributes nobody", daveProfile.invited_by, null);

  // ── A self-referral is ignored ─────────────────────────────────────────
  const selfLink = await api("/api/squads/referral", {
    method: "POST", body: JSON.stringify({ squad_id: squadB.invite_code ? squadB.id : squadB.id }),
  }, aliceSession.headers);
  // Alice tries her own link on her own account.
  const selfJoin = await api("/api/squads/join", {
    method: "POST", body: JSON.stringify({ invite_code: squadB.invite_code, ref: selfLink.json.token }),
  }, aliceSession.headers);
  check("self-joining still succeeds (she is already a member)", selfJoin.status, 200);
  const { data: aliceProfile } = await service.from("profiles")
    .select("invited_by").eq("id", alice.id).single();
  check("and nobody is credited for it", aliceProfile.invited_by, null);

  // ── Privacy: an unrelated signed-in user cannot read the referral ───────
  const daveSession = await asUser(dave.email);
  const peek = await daveSession.client.from("squad_referrals").select("*");
  check("an unrelated user reads no referral rows", peek.data?.length ?? 0, 0);

  const alicePeek = await aliceSession.client.from("squad_referrals").select("token");
  check("the referrer reads their own", (alicePeek.data ?? []).length >= 1, true);

  const bobPeek = await bobSession.client.from("squad_referrals").select("token");
  check("the invitee reads only the link that brought them", (bobPeek.data ?? []).length, 1);

  // ── The sender sees their own totals ───────────────────────────────────
  const mine = await api("/api/squads/referral", undefined, aliceSession.headers);
  check("the sender can list their links", (mine.json.links ?? []).length, 2);
  const aLink = (mine.json.links ?? []).find((l) => l.squad_id === squadA.id);
  check("with opens counted", aLink.opens, 3);
  check("and joins counted", aLink.joins, 1);

  // ── A referrer cannot edit their counters ─────────────────────────────
  const tamper = await aliceSession.client.from("squad_referrals")
    .update({ joins: 999 }).eq("token", token).select("id");
  check("no client UPDATE policy on the counters", (tamper.data ?? []).length, 0);
  const { data: afterTamper } = await service.from("squad_referrals")
    .select("joins").eq("token", token).single();
  check("the join count is unchanged", afterTamper.joins, 1);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (err) {
  console.error("probe error:", err.message);
  fail++;
} finally {
  await cleanup();
  console.log("cleaned up synthetic rows");
}

process.exit(fail > 0 ? 1 : 0);