import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  resolveUser,
} from "@/lib/supabase/service";
import { normalizeSlugList } from "@/lib/slug";

// CORS: only allow 1-click sync from leetcode.com + own site, never "*".
// "*" would let any site POST a victim's token-bearing request surface.
function corsHeadersFor(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const allowed = origin === "https://leetcode.com" || (site && origin === site);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mahayuddh-token",
  };
}

export async function OPTIONS(request: Request) {
  return NextResponse.json({}, { headers: corsHeadersFor(request) });
}

const MAX_SLUGS = 2000;
const IMPORT_COOLDOWN_MS = 60_000;

export async function POST(request: Request) {
  const cors = corsHeadersFor(request);
  // Auth JWT via standard Bearer or the bookmarklet's custom header.
  const token =
    extractBearerToken(request) || request.headers.get("x-mahayuddh-token");

  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: cors }
    );
  }

  const authedUser = await resolveUser(token);
  const userId = authedUser?.id ?? null;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized. Provide your Mahayuddh auth token." },
      { status: 401, headers: cors }
    );
  }

  // Shared throttle: same 60s cooldown as /api/sync/leetcode POST.
  const { data: limit } = await supabase
    .from("sync_rate_limits")
    .select("last_sync_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (limit?.last_sync_at) {
    const elapsed = Date.now() - new Date(limit.last_sync_at).getTime();
    if (elapsed < IMPORT_COOLDOWN_MS) {
      const retryAfter = Math.ceil((IMPORT_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Sync on cooldown. Retry in ${retryAfter}s.` },
        { status: 429, headers: { ...cors, "Retry-After": String(retryAfter) } }
      );
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const slugs: unknown[] = Array.isArray(body.slugs) ? body.slugs : [];

    if (slugs.length === 0) {
      return NextResponse.json(
        { error: "No problem slugs provided" },
        { status: 400, headers: cors }
      );
    }
    if (slugs.length > MAX_SLUGS) {
      return NextResponse.json(
        { error: `Too many slugs (max ${MAX_SLUGS})` },
        { status: 400, headers: cors }
      );
    }

    // Junk slugs ("__proto__", "../x", 10KB strings) rejected before DB touch.
    const uniqueSlugs = normalizeSlugList(slugs, MAX_SLUGS);
    if (uniqueSlugs.length === 0) {
      return NextResponse.json(
        { error: "No valid problem slugs provided" },
        { status: 400, headers: cors }
      );
    }

    // Self-attested import: only inserts brand-new rows. Manual "attempted"
    // flags are preserved by the DB trigger; only the verified LeetCode
    // session path may promote them via the RPC.
    // Honest counts: ignoreDuplicates returns no row count, so diff against
    // pre-existing slugs instead of echoing input size.
    const { data: existing } = await supabase
      .from("user_problem_status")
      .select("problem_slug")
      .eq("user_id", userId)
      .in("problem_slug", uniqueSlugs);
    const existingSet = new Set((existing ?? []).map((r) => r.problem_slug));
    const fresh = uniqueSlugs.filter((s) => !existingSet.has(s));

    const CHUNK = 300;
    let totalImported = 0;

    for (let i = 0; i < fresh.length; i += CHUNK) {
      const chunk = fresh.slice(i, i + CHUNK);
      const rows = chunk.map((slug) => ({
        user_id: userId,
        problem_slug: slug,
        status: "solved",
        solved_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase
        .from("user_problem_status")
        .upsert(rows, { onConflict: "user_id,problem_slug", ignoreDuplicates: true });

      if (!upsertErr) {
        totalImported += chunk.length;
      } else {
        console.error("Solved slugs upsert error:", upsertErr);
      }
    }

    await supabase
      .from("sync_rate_limits")
      .upsert({ user_id: userId, last_sync_at: new Date().toISOString() }, { onConflict: "user_id" });

    return NextResponse.json(
      { success: true, imported: totalImported, total: uniqueSlugs.length },
      { headers: cors }
    );
  } catch (err) {
    console.error("Solved slugs import error:", err);
    return NextResponse.json(
      { error: "Failed to import solved slugs" },
      { status: 500, headers: cors }
    );
  }
}
