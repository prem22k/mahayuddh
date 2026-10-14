import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  resolveUser,
  type ServiceClient,
} from "@/lib/supabase/service";
import { loginLeetCode, fetchSolvedSlugsFromSession } from "@/lib/leetcode";
import { encryptSession, decryptSession } from "@/lib/leetcodeSession";
import { readJsonBounded } from "@/lib/security/body";

// Marks a batch of solved slugs via the existing SECURITY DEFINER RPC, preserving
// manual "attempted" flags. Chunked to stay within RPC array limits.
// Honest counts: RPC returns rows actually inserted/promoted, not input size.
async function markSolved(
  supabase: ServiceClient,
  userId: string,
  slugs: string[]
): Promise<number> {
  const CHUNK = 500;
  let marked = 0;
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const slice = slugs.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc("mark_solved_from_leetcode", {
      p_user_id: userId,
      p_slugs: slice,
    });
    if (error) {
      console.error("mark_solved_from_leetcode error:", error);
      continue;
    }
    marked += typeof data === "number" ? data : 0;
  }
  return marked;
}

const HISTORY_COOLDOWN_MS = 60_000;
const MAX_COOKIE_LEN = 2048;

export async function POST(request: Request) {
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Validate user via Bearer token or server session cookies
  const user = await resolveUser(extractBearerToken(request));

  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  // Shared throttle: same 60s cooldown as other sync POSTs.
  const { data: limit } = await supabase
    .from("sync_rate_limits")
    .select("last_sync_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (limit?.last_sync_at) {
    const elapsed = Date.now() - new Date(limit.last_sync_at).getTime();
    if (elapsed < HISTORY_COOLDOWN_MS) {
      const retryAfter = Math.ceil((HISTORY_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Sync on cooldown. Retry in ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  // Bounded read. This body carries the caller's LeetCode password, so an
  // unbounded parse is both a memory-exhaustion vector and a place where a
  // secret sits in an arbitrarily large buffer.
  const parsed = await readJsonBounded(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as {
    username?: string;
    password?: string;
    sessionCookie?: string;
  };
  const {
    username,
    password,
    sessionCookie: inputCookie,
  }: { username?: string; password?: string; sessionCookie?: string } = body;

  // Ownership check: handle claim must not steal another member's handle.
  const handle = typeof username === "string" && username.trim() ? username.trim().toLowerCase() : null;
  if (handle) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("id")
      .eq("leetcode_username", handle)
      .maybeSingle();
    if (owner && owner.id !== user.id) {
      return NextResponse.json({ error: "Forbidden. This LeetCode handle belongs to another squad member." }, { status: 403 });
    }
  }

  try {
    let sessionCookie: string | null = null;
    let encrypted: string | null = null;
    let slugs: string[] | null = null;

    if (inputCookie && typeof inputCookie === "string" && inputCookie.trim()) {
      let clean = inputCookie.trim();
      if (!clean.includes("=")) {
        clean = `LEETCODE_SESSION=${clean}`;
      }
      if (clean.length > MAX_COOKIE_LEN) {
        return NextResponse.json({ error: "Session cookie too long" }, { status: 400 });
      }
      // Validate-before-store: dead cookies never touch the DB.
      slugs = await fetchSolvedSlugsFromSession(clean);
      if (slugs === null) {
        return NextResponse.json(
          { error: "LeetCode session invalid or expired. Paste a fresh LEETCODE_SESSION cookie." },
          { status: 400 }
        );
      }
      sessionCookie = clean;
      encrypted = encryptSession(sessionCookie);
      await supabase
        .from("profiles")
        .update({
          leetcode_session_encrypted: encrypted,
          leetcode_session_synced_at: new Date().toISOString(),
          ...(handle ? { leetcode_username: handle } : {}),
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
          ...(handle ? { leetcode_username: handle } : {}),
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

    // Pasted-cookie path already fetched slugs above; reuse them.
    if (!slugs) {
      try {
        sessionCookie = decryptSession(encrypted);
      } catch {
        return NextResponse.json(
          { error: "Stored session unreadable. Paste a fresh LEETCODE_SESSION cookie." },
          { status: 400 }
        );
      }
      slugs = await fetchSolvedSlugsFromSession(sessionCookie);
    }
    if (!slugs || slugs.length === 0) {
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
    await supabase
      .from("sync_rate_limits")
      .upsert({ user_id: user.id, last_sync_at: new Date().toISOString() }, { onConflict: "user_id" });

    return NextResponse.json({ success: true, imported });
  } catch (error) {
    console.error("LeetCode history import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

// DELETE: remove the stored LeetCode session (Bible §43 — session is an
// optional enhancement, never a core dependency). Identity, squads, notes,
// challenges, and history survive; only the evidence badge is lost.
export async function DELETE(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const user = await resolveUser(extractBearerToken(request));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }
  const { error } = await supabase
    .from("profiles")
    .update({ leetcode_session_encrypted: null, leetcode_session_synced_at: null })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "Failed to remove session" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
