/**
 * Notebook and vault sharing. RUNS AGAINST THE LIVE DB.
 *
 * This suite exists because of the bug it was written after: /notebook and
 * /vault returned 500 for every signed-in user, with
 *
 *     infinite recursion detected in policy for relation "notebook_notes"
 *
 * The cycle was in the policies, not the code — notebook_notes policies read
 * note_shares, whose policy read notebook_notes back. One sharing feature took
 * down both pages, which from the user's point of view are the same feature.
 *
 * It survived a long time because the static audit only checks INSERT columns,
 * the composer suite covers the editor rather than the list, and nothing ever did
 * a plain authenticated SELECT on either table. A total failure stayed invisible
 * because no test looked at it.
 *
 * So the first two checks are the regression guard: a bare authenticated read of
 * both tables, which is the exact call that used to fail. The rest pin that
 * removing the recursion did not quietly widen access, which is the risk in any
 * RLS fix — the easy way to kill an infinite loop is to delete a policy.
 *
 * Run: npm run test:integration:notebook
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const tag = `nb${Date.now()}`.slice(0, 14);
const made = { users: [], notes: [], shares: [] };
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
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function makeUser() {
  const email = `${tag}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  made.users.push(data.user.id);
  const username = `${tag}${Math.random().toString(36).slice(2, 5)}`.slice(0, 24);
  const { error: pErr } = await service.from("profiles").insert({ id: data.user.id, username });
  if (pErr) throw new Error(`profile: ${pErr.message}`);
  return { id: data.user.id, email };
}

async function asUser(email) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function cleanup() {
  for (const id of made.shares) await service.from("note_shares").delete().eq("id", id);
  for (const id of made.notes) await service.from("notebook_notes").delete().eq("id", id);
  for (const id of made.users) {
    await service.from("profiles").delete().eq("id", id);
    await service.auth.admin.deleteUser(id).catch(() => {});
  }
}

async function main() {
  console.log("Notebook / vault — the read that used to 500\n");

  const owner = await makeUser();
  const recipient = await makeUser();
  const bystander = await makeUser();
  const ownerCli = await asUser(owner.email);
  const recipCli = await asUser(recipient.email);
  const byCli = await asUser(bystander.email);

  // ── the regression itself ──────────────────────────────────────────────────
  console.log("regression: a bare authenticated read must not hit policy recursion");

  await check("owner can read their own notes", async () => {
    const { data, error } = await ownerCli.from("notebook_notes").select("id").limit(1);
    assert(!error, `notebook_notes read failed: ${error?.message}`);
    assert(Array.isArray(data), "expected an array");
  });

  await check("owner can read shares on their own notes", async () => {
    const { error } = await ownerCli.from("note_shares").select("id").limit(1);
    assert(!error, `note_shares read failed: ${error?.message}`);
  });

  await check("a user who owns nothing can still read (no recursion for them either)", async () => {
    const { error } = await byCli.from("notebook_notes").select("id").limit(1);
    assert(!error, `read failed for a user with no notes: ${error?.message}`);
  });

  await check("an anonymous visitor can read public notes without recursion", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.from("notebook_notes").select("id").limit(1);
    assert(!error, `anon read failed: ${error?.message}`);
  });

  // ── and that access is still correct ───────────────────────────────────────
  console.log("\nremoving the recursion must not have widened access");

  const { data: note, error: nErr } = await service.from("notebook_notes").insert({
    owner_id: owner.id,
    title: `${tag} private note`,
    body_md: "private",
    visibility: "private",
  }).select("id, title").single();
  if (nErr) throw new Error(`note insert: ${nErr.message}`);
  made.notes.push(note.id);

  await check("the owner sees their own note", async () => {
    const { data } = await ownerCli.from("notebook_notes").select("id").eq("id", note.id);
    assert(data?.length === 1, "owner cannot see their own note");
  });

  await check("an unshared private note is invisible to others", async () => {
    const { data } = await byCli.from("notebook_notes").select("id").eq("id", note.id);
    assert(data?.length === 0, "a private note leaked to an unrelated user");
  });

  await check("an unshared private note is invisible to a logged-in stranger", async () => {
    const { data } = await recipCli.from("notebook_notes").select("id").eq("id", note.id);
    assert(data?.length === 0, "a private note leaked before it was shared");
  });

  // Share it for reading only.
  const { data: share, error: sErr } = await service.from("note_shares").insert({
    note_id: note.id,
    shared_with: recipient.id,
    can_edit: false,
  }).select("id").single();
  if (sErr) throw new Error(`share insert: ${sErr.message}`);
  made.shares.push(share.id);

  await check("a read-only recipient can now read the note", async () => {
    const { data } = await recipCli.from("notebook_notes").select("id").eq("id", note.id);
    assert(data?.length === 1, "the recipient cannot read a note shared with them");
  });

  await check("a read-only recipient CANNOT edit it", async () => {
    // The can_edit distinction is the whole reason the helper takes
    // p_need_edit. Losing it would look like a working fix.
    const { data: rows } = await recipCli.from("notebook_notes")
      .update({ body_md: "tampered" }).eq("id", note.id).select();
    assert(rows?.length === 0, "a read-only share was allowed to edit");
    const { data: after } = await service.from("notebook_notes").select("body_md").eq("id", note.id).single();
    assert(after.body_md === "private", "the note body changed despite the update being blocked");
  });

  await check("a bystander still cannot read it", async () => {
    const { data } = await byCli.from("notebook_notes").select("id").eq("id", note.id);
    assert(data?.length === 0, "a shared note leaked to an unrelated user");
  });

  await check("the recipient can see their own share row", async () => {
    const { data } = await recipCli.from("note_shares").select("id").eq("id", share.id);
    assert(data?.length === 1, "the recipient cannot see their own share");
  });

  await check("a bystander cannot see someone else's share row", async () => {
    const { data } = await byCli.from("note_shares").select("id").eq("id", share.id);
    assert(data?.length === 0, "a share row leaked to an unrelated user");
  });

  await check("a non-owner cannot add a share to a note they do not own", async () => {
    const { error } = await byCli.from("note_shares")
      .insert({ note_id: note.id, shared_with: byCli ? bystander.id : bystander.id, can_edit: true });
    assert(error, "RLS allowed sharing a note the caller does not own");
  });

  await check("a non-owner cannot delete the owner's share row", async () => {
    const { data: rows } = await byCli.from("note_shares").delete().eq("id", share.id).select();
    assert(rows?.length === 0, "a non-owner deleted a share row");
  });

  // ── upgrade to edit ────────────────────────────────────────────────────────
  console.log("\nthe can_edit escalation still works");

  await check("the owner can upgrade a share to edit", async () => {
    const { data: rows, error } = await ownerCli.from("note_shares")
      .update({ can_edit: true }).eq("id", share.id).select();
    assert(!error, `owner could not update the share: ${error?.message}`);
    assert(rows?.length === 1, `owner update silently matched ${rows?.length ?? 0} rows`);
  });

  await check("the recipient can now edit, and the write really landed", async () => {
    const { data: rows, error } = await recipCli.from("notebook_notes")
      .update({ body_md: "edited by recipient" }).eq("id", note.id).select("id, body_md");
    assert(!error, `editor update errored: ${error?.message}`);
    assert(rows?.length === 1, "the editor's update matched no rows — silent failure");
    assert(rows?.[0]?.body_md === "edited by recipient", "the body did not change");
  });

  await check("a bystander still cannot edit after the upgrade", async () => {
    const { data: rows } = await byCli.from("notebook_notes")
      .update({ body_md: "bystander" }).eq("id", note.id).select();
    assert(rows?.length === 0, "an unrelated user could edit a shared note");
  });

  // ── the helpers are not a public oracle ────────────────────────────────────
  await check("an anonymous caller gets false, not an answer about somebody else", async () => {
    // anon needs EXECUTE for the public-notes policy to evaluate, so the helper
    // is reachable. What must not be reachable is the ANSWER: with no user
    // argument, auth.uid() is NULL, so the subquery matches nothing.
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const { data: ownerAnswer, error: oErr } = await anon.rpc("owns_note", { p_note_id: note.id });
    assert(!oErr, `anon calling owns_note errored: ${oErr?.message}`);
    assert(ownerAnswer === false, `anon learned note ownership: ${ownerAnswer}`);
    const { data: shareAnswer, error: sErr } = await anon.rpc("note_shared_with", {
      p_note_id: note.id, p_need_edit: false,
    });
    assert(!sErr, `anon calling note_shared_with errored: ${sErr?.message}`);
    assert(shareAnswer === false, `anon learned who a note is shared with: ${shareAnswer}`);
  });

  await check("a signed-in stranger gets false for someone else's note", async () => {
    // The helper is callable by any authenticated user, so the guarantee that
    // matters is that it reports the CALLER's access only.
    const { data } = await byCli.rpc("owns_note", { p_note_id: note.id });
    assert(data === false, `a stranger was told they own the note: ${data}`);
    const { data: shared } = await byCli.rpc("note_shared_with", { p_note_id: note.id, p_need_edit: false });
    assert(shared === false, `a stranger was told they have access: ${shared}`);
  });

  await check("the owner gets true for their own note", async () => {
    const { data } = await ownerCli.rpc("owns_note", { p_note_id: note.id });
    assert(data === true, `the owner was not recognised: ${data}`);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exitCode = 1; }
}

main()
  .catch((e) => { console.error(`\nharness error: ${e.message}`); process.exitCode = 1; })
  .finally(cleanup);
