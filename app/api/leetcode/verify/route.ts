import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { readJsonBounded, maxBodyBytesFor } from "@/lib/security/body";
import { redactForLog } from "@/lib/security/log";
import { rateLimit, rateLimitKey } from "@/lib/security/rateLimit";
import { fetchLeetCodeOwnershipFields } from "@/lib/leetcode";
import {
  generateVerifyCode,
  normalizeLeetCodeHandle,
  profileHasCode,
  VERIFY_CODE_TTL_MS,
} from "@/lib/leetcodeVerify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const auth = await requireUser(request, "/api/leetcode/verify");
  if (auth.response) return auth.response;
  const user = auth.user;

  // Parse bounded JSON body
  const parsed = await readJsonBounded<Record<string, unknown>>(
    request,
    maxBodyBytesFor("/api/leetcode/verify")
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const body = parsed.value ?? {};
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "start") {
    // Rate limit: 6 per 10 minutes
    const limit = rateLimit({
      key: rateLimitKey("write", { userId: `lcverify-start:${user.id}` }),
      limit: 6,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: `Too many codes. Retry in ${limit.retryAfterSec}s.`,
          retry_after: limit.retryAfterSec,
        },
        { status: 429 }
      );
    }

    const normalized = normalizeLeetCodeHandle(body.handle);
    if (!normalized) {
      return NextResponse.json(
        { error: "That doesn't look like a LeetCode username." },
        { status: 400 }
      );
    }

    const fields = await fetchLeetCodeOwnershipFields(normalized);
    if (fields.status === "not_found") {
      return NextResponse.json(
        { error: `No LeetCode account called @${normalized}.` },
        { status: 404 }
      );
    }
    if (fields.status === "unreachable") {
      return NextResponse.json(
        { error: "Couldn't reach LeetCode. Try again in a minute." },
        { status: 503 }
      );
    }

    const handle = fields.username.toLowerCase();

    // 3. Caller's profile already verified
    const { data: profile } = await supabase
      .from("profiles")
      .select("leetcode_username, leetcode_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profile?.leetcode_username?.trim().toLowerCase() === handle &&
      profile?.leetcode_verified_at != null
    ) {
      return NextResponse.json({ status: "verified", handle }, { status: 200 });
    }

    // 4. Check existing code reuse (> 2 mins away)
    const { data: existingRow } = await supabase
      .from("leetcode_verifications")
      .select("user_id, handle, code, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const now = Date.now();
    let code: string;
    let expires_at: string;

    if (
      existingRow &&
      existingRow.handle.toLowerCase() === handle &&
      new Date(existingRow.expires_at).getTime() - now > 2 * 60 * 1000
    ) {
      code = existingRow.code;
      expires_at = existingRow.expires_at;
    } else {
      code = generateVerifyCode();
      expires_at = new Date(now + VERIFY_CODE_TTL_MS).toISOString();
      const { error: upsertErr } = await supabase
        .from("leetcode_verifications")
        .upsert(
          {
            user_id: user.id,
            handle,
            code,
            expires_at,
          },
          { onConflict: "user_id" }
        );
      if (upsertErr) {
        console.warn(
          "leetcode_verifications upsert error:",
          redactForLog({ error: upsertErr.message, userId: user.id, handle })
        );
        return NextResponse.json({ error: "Couldn't create a code. Try again." }, { status: 500 });
      }
    }

    return NextResponse.json(
      { status: "pending", handle, code, expires_at },
      { status: 200 }
    );
  }

  if (action === "check") {
    // Rate limit: 1 per 8 seconds
    const limit = rateLimit({
      key: rateLimitKey("write", { userId: `lcverify-check:${user.id}` }),
      limit: 1,
      windowMs: 8 * 1000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: `Checking too fast. Retry in ${limit.retryAfterSec}s.`,
          retry_after: limit.retryAfterSec,
        },
        { status: 429 }
      );
    }

    // 1. Load caller's row
    const { data: row } = await supabase
      .from("leetcode_verifications")
      .select("user_id, handle, code, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: "Get a code first." }, { status: 404 });
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "That code expired. Get a new one." },
        { status: 410 }
      );
    }

    // 2. Fetch ownership fields
    const fields = await fetchLeetCodeOwnershipFields(row.handle);
    if (fields.status === "not_found") {
      return NextResponse.json(
        { error: `No LeetCode account called @${row.handle}.` },
        { status: 404 }
      );
    }
    if (fields.status === "unreachable") {
      return NextResponse.json(
        { error: "Couldn't reach LeetCode. Try again in a minute." },
        { status: 503 }
      );
    }

    // 3. Check if profile contains code
    if (!profileHasCode(fields, row.code)) {
      return NextResponse.json(
        {
          status: "not_found_yet",
          handle: row.handle,
          code: row.code,
          expires_at: row.expires_at,
          error: `We couldn't find ${row.code} on @${row.handle}'s LeetCode profile yet. Paste it into your Summary, save on LeetCode, then check again.`,
        },
        { status: 200 }
      );
    }

    // 4. Claim handle via RPC
    const { data, error: rpcErr } = await supabase.rpc("claim_leetcode_handle", {
      p_user_id: user.id,
      p_handle: row.handle,
    });
    if (rpcErr) {
      console.warn(
        "claim_leetcode_handle error:",
        redactForLog({ error: rpcErr.message, userId: user.id, handle: row.handle })
      );
      return NextResponse.json({ error: "Couldn't save that. Check again." }, { status: 500 });
    }

    return NextResponse.json(
      {
        status: "verified",
        handle: row.handle,
        released_other: (data ?? 0) > 0,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
