import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { loginLeetCode, fetchSolvedSlugsFromSession } from "@/lib/leetcode";
import { encryptSession, decryptSession } from "@/lib/leetcodeSession";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type ServiceClient = NonNullable<ReturnType<typeof getServiceClient>>;

// Marks a batch of solved slugs via the existing SECURITY DEFINER RPC, preserving
// manual "attempted" flags. Chunked to stay within RPC array limits.
async function markSolved(
  supabase: ServiceClient,
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
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = getServiceClient();

  if (!anonUrl || !anonKey || !supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Validate user via Bearer token or server session cookies
  let user: { id: string; email?: string } | null = null;
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (token) {
    const userClient = createClient(anonUrl, anonKey, { auth: { persistSession: false } });
    const { data } = await userClient.auth.getUser(token);
    user = data?.user ?? null;
  }

  if (!user) {
    try {
      const serverSupabase = await createServerClient();
      const { data } = await serverSupabase.auth.getUser();
      user = data?.user ?? null;
    } catch {
      // ignore
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    username,
    password,
    sessionCookie: inputCookie,
  }: { username?: string; password?: string; sessionCookie?: string } = body;

  try {
    let sessionCookie: string | null = null;
    let encrypted: string | null = null;

    if (inputCookie && typeof inputCookie === "string" && inputCookie.trim()) {
      let clean = inputCookie.trim();
      if (!clean.includes("=")) {
        clean = `LEETCODE_SESSION=${clean}`;
      }
      sessionCookie = clean;
      encrypted = encryptSession(sessionCookie);
      await supabase
        .from("profiles")
        .update({
          leetcode_session_encrypted: encrypted,
          leetcode_session_synced_at: new Date().toISOString(),
          ...(username ? { leetcode_username: username.trim() } : {}),
        })
        .eq("id", user.id);
    } else if (password) {
      sessionCookie = await loginLeetCode(username ?? user.email ?? "", password);
      if (!sessionCookie) {
        return NextResponse.json(
          {
            error:
              "LeetCode direct password login was blocked by Cloudflare/Captcha. Please paste your LEETCODE_SESSION cookie from browser DevTools, or connect your handle directly without a password.",
          },
          { status: 400 }
        );
      }
      encrypted = encryptSession(sessionCookie);
      await supabase
        .from("profiles")
        .update({
          leetcode_session_encrypted: encrypted,
          leetcode_session_synced_at: new Date().toISOString(),
          ...(username ? { leetcode_username: username.trim() } : {}),
        })
        .eq("id", user.id);
    } else {
      // Reuse a previously stored session.
      const { data: profile } = await supabase
        .from("profiles")
        .select("leetcode_session_encrypted")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.leetcode_session_encrypted) {
        return NextResponse.json(
          { error: "No stored LeetCode session. Provide username + password or paste your LEETCODE_SESSION cookie." },
          { status: 400 }
        );
      }
      encrypted = profile.leetcode_session_encrypted;
    }

    if (!encrypted) {
      return NextResponse.json({ error: "Session encryption failed" }, { status: 500 });
    }

    sessionCookie = decryptSession(encrypted);

    const slugs = await fetchSolvedSlugsFromSession(sessionCookie);
    if (slugs.length === 0) {
      return NextResponse.json({
        imported: 0,
        note: "No solved problems returned (session cookie may be expired).",
      });
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
