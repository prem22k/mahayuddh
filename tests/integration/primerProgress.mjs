/**
 * Primer progress — RUNS AGAINST A REAL DATABASE (whatever .env.local points
 * at). Creates two throwaway users and deletes them, and their rows, after.
 *
 * Calls the app's real data functions as each user (see _libLoader.mjs):
 *   - markPrimerRead / markPrimerMastered store the FIRST time only
 *   - getMyPrimerProgress returns your rows and nobody else's
 *   - another user can't read or overwrite your progress through RLS
 *
 * Run: npm run test:integration:primers
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

const { markPrimerRead, markPrimerMastered, getMyPrimerProgress } = await import("@/lib/data/primerProgress");

const tag = `pp${Date.now()}`;
const users = [];

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

async function makeUser(i) {
  const email = `${tag}_${i}@probe.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: "probe-pw-123", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  users.push(data.user.id);
  await db.from("profiles").insert({ id: data.user.id, username: `${tag}_${i}` });
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await c.auth.signInWithPassword({ email, password: "probe-pw-123" });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  return { id: data.user.id, client: c };
}

async function as(user, fn) {
  globalThis.__testSupabase = user.client;
  try {
    return await fn(user.client);
  } finally {
    globalThis.__testSupabase = undefined;
  }
}

try {
  const a = await makeUser(1);
  const b = await makeUser(2);

  await as(a, async () => {
    check("first read is stored", await markPrimerRead("sliding-window"), true);
    const first = (await getMyPrimerProgress())["sliding-window"]?.read_at;
    await new Promise((r) => setTimeout(r, 1100));
    check("reading again doesn't count as a new read", await markPrimerRead("sliding-window"), false);
    const again = (await getMyPrimerProgress())["sliding-window"]?.read_at;
    check("read_at keeps the first time", again, first);
    check("mastery is stored once", [await markPrimerMastered("sliding-window"), await markPrimerMastered("sliding-window")], [true, false]);
    const mine = await getMyPrimerProgress();
    check("your progress lists what you touched", Object.keys(mine), ["sliding-window"]);
  });

  await as(b, async (c) => {
    check("someone else sees none of your progress", Object.keys(await getMyPrimerProgress()).length, 0);
    const { data } = await c.from("primer_progress").select("user_id").eq("user_id", a.id);
    check("RLS hides another user's rows", (data ?? []).length, 0);
    await c.from("primer_progress").update({ read_at: null }).eq("user_id", a.id);
    const { error } = await c.from("primer_progress").insert({ user_id: a.id, primer_slug: "stack", read_at: new Date().toISOString() });
    check("you can't write progress for someone else", Boolean(error), true);
  });
  const { data: still } = await db.from("primer_progress").select("read_at").eq("user_id", a.id).eq("primer_slug", "sliding-window").single();
  check("another user's update can't clear your read", still.read_at !== null, true);
} catch (e) {
  console.error("probe error:", e.message);
  fail++;
} finally {
  for (const u of users) {
    await db.from("primer_progress").delete().eq("user_id", u);
    await db.from("profiles").delete().eq("id", u);
    try { await db.auth.admin.deleteUser(u); } catch { /* already gone */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
