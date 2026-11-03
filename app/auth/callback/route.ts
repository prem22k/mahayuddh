import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

/**
 * Lands every emailed link (password reset) and every social sign-in. On
 * success it continues to ?next=. On failure it goes back to /login, keeping
 * ?next= so a retry still ends up where the visitor was going, and says why:
 * - the visitor cancelled at the provider (OAuth `error=access_denied`),
 * - the provider or Supabase refused (any other `error`), or
 * - the code was missing, used or expired.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Same-origin relative-path guard shared with middleware + login page.
  const next = safeNext(searchParams.get("next")) ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const providerError = searchParams.get("error");

  // No code but already signed in: an emailed link was verified by
  // /auth/confirm, whose RedirectTo points back through here. Nothing to
  // exchange; continue.
  if (!code && !providerError) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return NextResponse.redirect(`${origin}${next}`);
  }
  const reason = !providerError
    ? "auth_callback_failed"
    : providerError === "access_denied"
      ? "oauth_cancelled"
      : "oauth_failed";
  // ?next= may point at /auth/finish?next=<target>; the login page wants the
  // target itself.
  const target = next.startsWith("/auth/finish")
    ? (safeNext(new URL(next, origin).searchParams.get("next")) ?? "/home")
    : next;
  // Connecting a provider from the profile (linkIdentity) comes back here
  // signed in. Its failures belong on the profile card: /login would just
  // forward a signed-in visitor on and drop the message.
  if (new URL(target, origin).pathname === "/profile") {
    const code = searchParams.get("error_code");
    const linkError =
      code === "identity_already_exists" ? "taken" : providerError === "access_denied" ? "cancelled" : "failed";
    return NextResponse.redirect(`${origin}/profile?link_error=${linkError}`);
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", reason);
  // A failed reset link must not send a later plain sign-in to the
  // password-change page, so /auth/* targets are dropped.
  if (target !== "/" && !target.startsWith("/auth/")) login.searchParams.set("next", target);
  return NextResponse.redirect(login.toString());
}
