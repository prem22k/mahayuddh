import { NextResponse } from "next/server";
import { getServiceClient, extractBearerToken, requireUser } from "@/lib/supabase/service";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { readJsonBounded } from "@/lib/security/body";
import { logSecurityEvent } from "@/lib/security/log";
import { isRecentSignIn } from "@/lib/auth/jwtClaims";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/auth/account: delete the caller's own account, now.
 *
 * Trust boundary: the account deleted is the one the bearer token resolves to
 * (requireUser), never an id from the request. Two more gates, because this
 * can't be undone:
 *   1. the session must have signed in within the last 10 minutes (the
 *      token's amr claim), so a stolen or long-lived session can't do it;
 *      otherwise 401 { reauth: true } and the client asks for a fresh sign-in;
 *   2. the body must repeat the display name ({ confirm }), case-insensitive.
 *
 * What goes: the auth user, and through ON DELETE CASCADE the profile and
 * everything that belongs to it (solves, battles, notes, approaches, posts,
 * notifications, memberships, analytics). Squads where the caller is the only
 * member are deleted first (a squad with nobody in it is just litter); squads
 * with other members keep going. Primers the caller wrote are deleted too:
 * their author column only nulls on delete, which would leave them behind.
 */
export async function DELETE(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/auth/account");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({ ...RATE_RULES.write, key: rateLimitKey("write", { userId: user.id }) });
  if (!limit.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  if (!isRecentSignIn(extractBearerToken(request))) {
    logSecurityEvent("account.delete_reauth_required", { route: "/api/auth/account", actor_id: user.id });
    return NextResponse.json(
      { error: "For your safety, sign in again, then delete your account.", reauth: true },
      { status: 401 }
    );
  }

  const parsed = await readJsonBounded<{ confirm?: unknown }>(request);
  if (!parsed.ok) return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  const confirm = typeof parsed.value?.confirm === "string" ? parsed.value.confirm.trim().toLowerCase() : "";

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const expected = (profile?.username ?? "").trim().toLowerCase();
  if (!expected || confirm !== expected) {
    return NextResponse.json({ error: "Type your name exactly as shown to confirm." }, { status: 400 });
  }

  // Squads where nobody else is left.
  const { data: memberships } = await supabase.from("squad_members").select("squad_id").eq("user_id", user.id);
  const squadIds = (memberships ?? []).map((m) => m.squad_id as string);
  if (squadIds.length) {
    const { data: others } = await supabase
      .from("squad_members")
      .select("squad_id")
      .in("squad_id", squadIds)
      .neq("user_id", user.id);
    const stillUsed = new Set((others ?? []).map((m) => m.squad_id as string));
    const empty = squadIds.filter((id) => !stillUsed.has(id));
    if (empty.length) {
      const { error } = await supabase.from("squads").delete().in("id", empty);
      if (error) return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 });
    }
  }

  const { error: primerError } = await supabase.from("primers").delete().eq("author_id", user.id);
  if (primerError) return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 });

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    logSecurityEvent("account.delete_failed", { route: "/api/auth/account", actor_id: user.id });
    return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 });
  }

  logSecurityEvent("account.deleted", { route: "/api/auth/account", actor_id: user.id });
  return NextResponse.json({ deleted: true });
}
