import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  requireUser,
} from "@/lib/supabase/service";
import { rateLimit, rateLimitKey, RATE_RULES } from "@/lib/security/rateLimit";
import { logSecurityEvent } from "@/lib/security/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/revoke-sessions — global sign-out (control 3).
 *
 * Called right after a password update from a recovery session. Signs the
 * caller's account out of EVERY session, including the current one, so a
 * password change made under suspicion actually ends the other access.
 *
 * Trust boundary: the bearer token is the caller's own access token, resolved
 * to a user first (requireUser). The admin client then signs out globally for
 * that user id — never an id taken from the request body, so a caller cannot
 * revoke somebody else's sessions.
 */
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const auth = await requireUser(request, "/api/auth/revoke-sessions");
  if (auth.response) return auth.response;
  const user = auth.user;

  const limit = rateLimit({
    ...RATE_RULES.write,
    key: rateLimitKey("write", { userId: user.id }),
  });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in again to confirm." }, { status: 401 });

  const { error } = await supabase.auth.admin.signOut(token, "global");
  if (error) {
    logSecurityEvent("session.revoke_failed", {
      route: "/api/auth/revoke-sessions",
      actor_id: user.id,
    });
    return NextResponse.json({ error: "Couldn't revoke sessions." }, { status: 400 });
  }

  logSecurityEvent("session.revoked_global", {
    route: "/api/auth/revoke-sessions",
    actor_id: user.id,
  });
  return NextResponse.json({ revoked: true });
}
