import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loginLeetCode, fetchSolvedSlugsFromSession } from "@/lib/leetcode";
import { encryptSession } from "@/lib/leetcodeSession";

// Marks a batch of solved slugs via the existing SECURITY DEFINER RPC, preserving
// manual "attempted" flags. Chunked to stay within RPC array limits.
async function markSolved(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  slugs: string[]
): Promise<number> {
  const CHUNK = 500;
  let marked = 0;
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const slice = slugs.slice(i, i + CHUNK);
    const { error } = await supabase.rpc("mark_solved_from_leetcode", {
      p_user_id: userId,
      p_slugs: slice,
    });
    if (error) {
      console.error("mark_solved_from_leetcode error:", error);
      continue;
    }
    marked += slice.length;
  }
  return marked;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  // The browser call is made by an authed Supabase user; we verify via the anon client.
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anonUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Validate the calling user from the Supabase JWT.
  const userClient = createClient(anonUrl, anonKey, { auth: { persistSession: false } });
  const {
    data: { user },
  } = await userClient.auth.getUser(authHeader?.replace(/^Bearer\s+/i, "") ?? "");

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { username, password }: { username?: string; password?: string } = body;

  const supabase = createClient(anonUrl, serviceKey, { auth: { persistSession: false } });

  try {
    let sessionCookie: string | null = null;
    let encrypted: string | null = null;

    if (password) {
      sessionCookie = await loginLeetCode(username ?? user.email ?? "", password);
      if (!sessionCookie) {
        return NextResponse.json(
          { error: "LeetCode login failed. Check credentials, or reconnect later (2FA/captcha may be required)." },
          { status: 401 }
        );
      }
      encrypted = encryptSession(sessionCookie);
      await supabase
        .from("profiles")
        .update({
          leetcode_session_encrypted: encrypted,
          leetcode_session_synced_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } else {
      // Reuse a previously stored session.
      const { data: profile } = await supabase
        .from("profiles")
        .select("leetcode_session_encrypted")
        .eq("id", user.id)
        .single();
      if (!profile?.leetcode_session_encrypted) {
        return NextResponse.json(
          { error: "No stored LeetCode session. Provide username + password to connect." },
          { status: 400 }
        );
      }
      encrypted = profile.leetcode_session_encrypted;
    }

    const { decryptSession } = await import("@/lib/leetcodeSession");
    sessionCookie = decryptSession(encrypted);

    const slugs = await fetchSolvedSlugsFromSession(sessionCookie);
    if (slugs.length === 0) {
      return NextResponse.json({ imported: 0, note: "No solved problems returned (session may be expired)." });
    }

    const imported = await markSolved(supabase, user.id, slugs);
    await supabase
      .from("profiles")
      .update({ leetcode_session_synced_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({ success: true, imported });
  } catch (error) {
    console.error("LeetCode history import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
