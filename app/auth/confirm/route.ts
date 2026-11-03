import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

/**
 * Lands the links in our emails (signup confirmation, password reset).
 *
 * The email templates (scripts/setup-email.sh) link here with the one-time
 * token's hash instead of Supabase's default confirmation URL. The default
 * uses the PKCE code flow, which only completes in the browser that started
 * it: open the email on your phone and it fails. Verifying the token hash on
 * the server works on any device and sets the session cookie here.
 *
 * `next` comes from the template's {{ .RedirectTo }}, an absolute URL; only a
 * same-origin target is followed, reduced to its path.
 */
const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

function nextPath(raw: string | null, origin: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return null;
    return safeNext(`${u.pathname}${u.search}`);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/auth/update-password" : "/home";
  const next = nextPath(searchParams.get("next"), origin) ?? fallback;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // Used, expired or malformed link. A signup link that was already used has
  // still confirmed the address, so the login page's wording covers both.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
