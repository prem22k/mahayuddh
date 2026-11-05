import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/service";
import { readJsonBounded, maxBodyBytesFor } from "@/lib/security/body";
import { redactForLog } from "@/lib/security/log";
import { rateLimit, rateLimitKey } from "@/lib/security/rateLimit";
import { fetchRecentSubmissions } from "@/lib/leetcode";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const auth = await requireUser(request, "/api/battles/verify");
  if (auth.response) return auth.response;
  const user = auth.user;

  // Rate limit: 1 request per 20s per user
  const limit = rateLimit({
    key: rateLimitKey("write", { userId: `verify:${user.id}` }),
    limit: 1,
    windowMs: 20_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Verification on cooldown. Retry in ${limit.retryAfterSec}s.`,
        retry_after: limit.retryAfterSec,
      },
      { status: 429 }
    );
  }

  // Parse bounded JSON body
  const parsed = await readJsonBounded<Record<string, unknown>>(
    request,
    maxBodyBytesFor("/api/battles")
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const battleId = typeof parsed.value?.battle_id === "string" ? parsed.value.battle_id : "";
  if (!battleId) {
    return NextResponse.json({ error: "battle_id is required." }, { status: 400 });
  }

  // 1. Load the battle
  const { data: battle, error: battleErr } = await supabase
    .from("battles")
    .select("id, started_at, problem_slug")
    .eq("id", battleId)
    .eq("user_id", user.id)
    .eq("outcome", "in_progress")
    .maybeSingle();

  if (battleErr || !battle) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }

  // 2. Load the caller's profiles.leetcode_username
  const { data: profile } = await supabase
    .from("profiles")
    .select("leetcode_username, leetcode_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  const rawUsername = (profile as { leetcode_username?: string | null; leetcode_verified_at?: string | null } | null)?.leetcode_username;
  const username = rawUsername?.trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ linked: false }, { status: 200 });
  }

  const isVerified = (profile as { leetcode_verified_at?: string | null } | null)?.leetcode_verified_at != null;
  if (!isVerified) {
    return NextResponse.json({ linked: true, verified: false, username }, { status: 200 });
  }

  // 3. fetchRecentSubmissions with { fresh: true }
  const recents = await fetchRecentSubmissions(username, { fresh: true });
  if (!recents) {
    return NextResponse.json({ linked: true, verified: true, username, reachable: false }, { status: 200 });
  }

  // 4. Submissions filtering: timestamp >= floor(started_at_ms/1000) - 60
  const startedAtMs = new Date(battle.started_at).getTime();
  const thresholdSec = Math.floor(startedAtMs / 1000) - 60;

  // Query catalog difficulty for matching slugs if any
  const acceptedSlugs = recents
    .filter((sub) => {
      const ts = Number(sub.timestamp);
      return Number.isFinite(ts) && ts >= thresholdSec;
    })
    .map((sub) => sub.titleSlug.toLowerCase());

  const diffMap = new Map<string, string>();
  if (acceptedSlugs.length > 0) {
    const { data: lpData } = await supabase
      .from("list_problems")
      .select("title_slug,difficulty")
      .in("title_slug", acceptedSlugs);
    if (lpData) {
      for (const row of lpData as { title_slug: string; difficulty: string }[]) {
        diffMap.set(row.title_slug.toLowerCase(), row.difficulty);
      }
    }
  }

  // Group by lowercase titleSlug keeping EARLIEST timestamp
  const earliestBySlug = new Map<
    string,
    { slug: string; title: string; accepted_at: number; difficulty?: string }
  >();
  for (const sub of recents) {
    const ts = Number(sub.timestamp);
    if (!Number.isFinite(ts) || ts < thresholdSec) continue;
    const slug = sub.titleSlug.toLowerCase();
    const existing = earliestBySlug.get(slug);
    if (!existing || ts < existing.accepted_at) {
      earliestBySlug.set(slug, {
        slug,
        title: sub.title,
        accepted_at: ts,
        difficulty: diffMap.get(slug),
      });
    }
  }

  const solved = Array.from(earliestBySlug.values()).sort(
    (a, b) => a.accepted_at - b.accepted_at
  );

  const targetSlug = battle.problem_slug.toLowerCase();
  const target = earliestBySlug.get(targetSlug) ?? null;

  if (target) {
    const { error: stampErr } = await supabase
      .from("battles")
      .update({ evidence: "leetcode" })
      .eq("id", battleId)
      .eq("user_id", user.id)
      .eq("outcome", "in_progress");
    if (stampErr) {
      console.warn(
        "Failed to stamp battle evidence:",
        redactForLog({ error: stampErr.message, battle_id: battleId, user_id: user.id })
      );
    }
  }

  // 5. Mark OTHER solved questions for caller
  const otherSlugs = solved
    .filter((s) => s.slug !== targetSlug)
    .map((s) => s.slug);

  if (otherSlugs.length > 0) {
    try {
      const { error: rpcErr } = await supabase.rpc("mark_solved_from_leetcode", {
        p_user_id: user.id,
        p_slugs: otherSlugs,
      });
      if (rpcErr) {
        console.warn(
          "mark_solved_from_leetcode error:",
          redactForLog({ error: rpcErr.message, count: otherSlugs.length })
        );
      }
    } catch (err) {
      console.warn(
        "mark_solved_from_leetcode exception:",
        redactForLog({ error: String(err), count: otherSlugs.length })
      );
    }
  }

  return NextResponse.json(
    {
      linked: true,
      verified: true,
      username,
      reachable: true,
      started_at: battle.started_at,
      target,
      solved,
    },
    { status: 200 }
  );
}
