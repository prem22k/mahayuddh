/**
 * Privacy scopes — RUNS AGAINST A REAL DATABASE (local stack or the linked
 * project, whichever .env.local points at). Creates throwaway users and rows
 * and deletes every one on the way out, including on failure.
 *
 * Tables like suggestions, user_problem_status and discussions are readable
 * well beyond one person, so "mine", "my squad" and "this tab" are decided by
 * the data function's own filter or by RLS. This pins both, by calling the
 * app's real lib/data functions as a signed-in user (see _libLoader.mjs):
 *
 *   - getSuggestions(): only challenges you sent or received
 *   - getSquadProblemStatuses(): only the member ids it was given
 *   - getDiscussions(): each feed tab gets its own threads, and another
 *     squad's squad-only thread is never readable
 *
 * Run: npm run test:integration:privacy
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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("missing supabase env");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { getSuggestions } = await import("@/lib/data/suggestions");
const { getSquadProblemStatuses } = await import("@/lib/data/sheets");
const { getDiscussions } = await import("@/lib/data/feed");

const tag = `priv${Date.now()}`;
const made = { users: [], squads: [], suggestions: [], statuses: [], discussions: [], follows: [] };

async function cleanup() {
  for (const f of made.follows) await db.from("follows").delete().eq("follower_id", f);
  for (const d of made.discussions) await db.from("discussions").delete().eq("id", d);
  for (const s of made.statuses) await db.from("user_problem_status").delete().eq("id", s);
  for (const s of made.suggestions) await db.from("suggestions").delete().eq("id", s);
  for (const s of made.squads) await db.from("squads").delete().eq("id", s);
  for (const u of made.users) await db.from("profiles").delete().eq("id", u);
  for (const u of made.users) {
    try { await db.auth.admin.deleteUser(u); } catch { /* already gone */ }
  }
}

async function makeUser(i) {
  const email = `${tag}_${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  const { error: pErr } = await db.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}` });
  if (pErr) throw new Error(`profile: ${pErr.message}`);
  return { id: data.user.id, email };
}

async function makeSquad(members, i) {
  const { data, error } = await db
    .from("squads")
    .insert({ name: `priv-${tag}-${i}`, invite_code: `${tag}-s${i}`, created_by: members[0].id })
    .select("id").single();
  if (error) throw new Error(`squad: ${error.message}`);
  made.squads.push(data.id);
  for (const m of members) {
    const { error: mErr } = await db.from("squad_members").insert({ squad_id: data.id, user_id: m.id });
    if (mErr) throw new Error(`member: ${mErr.message}`);
  }
  return data.id;
}

async function insert(table, row, bucket) {
  const { data, error } = await db.from(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  made[bucket].push(data.id);
  return data.id;
}

/** Run fn with the app's data layer signed in as this user. */
async function as(user, fn) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: user.email, password: "probe-pw-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  globalThis.__testSupabase = c;
  try {
    return await fn();
  } finally {
    globalThis.__testSupabase = undefined;
  }
}

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}
const sorted = (xs) => [...xs].sort();

try {
  // Alice and Bob share a squad; Carol and Dan share another.
  const alice = await makeUser(1);
  const bob = await makeUser(2);
  const carol = await makeUser(3);
  const dan = await makeUser(4);
  const squadAB = await makeSquad([alice, bob], 1);
  const squadCD = await makeSquad([carol, dan], 2);

  // ── getSuggestions: only your challenges ─────────────────────────────────
  const challenge = (from, to, status = "pending") => ({
    from_user: from.id, to_user: to.id, problem_slug: `${tag}-p`, problem_title: "Probe", difficulty: "Easy", status,
  });
  const aToB = await insert("suggestions", challenge(alice, bob), "suggestions");
  const bToA = await insert("suggestions", challenge(bob, alice, "completed"), "suggestions");
  const cToD = await insert("suggestions", challenge(carol, dan, "completed"), "suggestions");

  await as(alice, async () => {
    const ids = (await getSuggestions()).map((s) => s.id).filter((id) => made.suggestions.includes(id));
    check("getSuggestions returns the challenges Alice sent and received", sorted(ids), sorted([aToB, bToA]));
    check("getSuggestions leaves out strangers' challenges", ids.includes(cToD), false);
  });

  // ── getSquadProblemStatuses: only the given members ──────────────────────
  const slug = `${tag}-two-sum`;
  for (const u of [alice, bob, carol]) {
    await insert("user_problem_status", { user_id: u.id, problem_slug: slug, status: "solved" }, "statuses");
  }
  await as(alice, async () => {
    const rows = await getSquadProblemStatuses([slug], [alice.id, bob.id]);
    check("getSquadProblemStatuses counts only the squad's members", sorted(rows.map((r) => r.user_id)), sorted([alice.id, bob.id]));
    check("getSquadProblemStatuses with no members returns nothing", (await getSquadProblemStatuses([slug], [])).length, 0);
  });

  // ── getDiscussions: per tab, and no other squad's private thread ─────────
  const thread = (author, squadId, visibility) => ({
    author_id: author.id, problem_slug: `${tag}-p`, pattern_tags: ["Arrays"],
    body_md: `Try the two-pointer version first. (${tag})`, squad_id: squadId, visibility,
  });
  const abSquadThread = await insert("discussions", thread(bob, squadAB, "squad"), "discussions");
  const cdSquadThread = await insert("discussions", thread(carol, squadCD, "squad"), "discussions");
  const cdGlobalThread = await insert("discussions", thread(dan, squadCD, "global"), "discussions");
  await db.from("follows").insert({ follower_id: alice.id, followed_id: dan.id });
  made.follows.push(alice.id);

  await as(alice, async () => {
    const ours = (rows) => rows.map((d) => d.id).filter((id) => made.discussions.includes(id));
    const squad = ours(await getDiscussions({ scope: "squad", squadId: squadAB, limit: 100 }));
    check("Squad tab shows only this squad's threads", sorted(squad), [abSquadThread]);

    const global = ours(await getDiscussions({ scope: "global", limit: 100 }));
    check("Global tab shows only threads marked global", sorted(global), [cdGlobalThread]);

    const following = ours(await getDiscussions({ scope: "following", limit: 100 }));
    check("Following tab shows followed authors' readable threads", sorted(following), [cdGlobalThread]);

    const peek = ours(await getDiscussions({ scope: "squad", squadId: squadCD, limit: 100 }));
    check("another squad's squad-only thread is not readable, even by asking for that squad", peek.includes(cdSquadThread), false);
  });
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
