import { NextResponse } from "next/server";
import {
  getServiceClient,
  extractBearerToken,
  resolveUser,
} from "@/lib/supabase/service";
import { readJsonBounded } from "@/lib/security/body";
import type { Profile } from "@/types/database";

const PUBLIC_PROFILE_SELECT =
  "id,username,leetcode_username,avatar_url,active_squad_id,contest_rating,global_rank,streak,total_easy,total_medium,total_hard,contest_attended,contest_global_rank,contest_top_percentage,last_synced_at,created_at";

async function getAuthedUserId(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return { error: "Missing authorization token" as const };
  const user = await resolveUser(token);
  if (!user) return { error: "Unauthorized" as const };
  return { user };
}

// Reads never mutate: GET only returns the caller's profile (404 when missing).
export async function GET(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authed = await getAuthedUserId(request);
  if ("error" in authed) {
    return NextResponse.json({ error: authed.error }, { status: 401 });
  }
  const { user } = authed;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ profile: existingProfile as Profile });
  }
  return NextResponse.json({ error: "Profile not found" }, { status: 404 });
}

// Profile creation lives here (POST), never in GET, so prefetch/cache can't
// create rows. Handle stays null until the owner claims it via authenticated
// POST /api/sync/leetcode — signup metadata is client-controlled and untrusted.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authed = await getAuthedUserId(request);
  if ("error" in authed) {
    return NextResponse.json({ error: authed.error }, { status: 401 });
  }
  const { user } = authed;

  try {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_SELECT)
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ profile: existingProfile as Profile });
    }

    let baseUsername =
      user.user_metadata?.username ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Squad Member";

    baseUsername = baseUsername.trim().slice(0, 30);
    if (!baseUsername) baseUsername = "Squad_Member";

    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    // Try insert; if collision on username, append random digits
    let createdProfile: Profile | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateUsername =
        attempt === 0 ? baseUsername : `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: inserted, error: insertErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            username: candidateUsername,
            leetcode_username: null,
            avatar_url: avatarUrl,
            contest_rating: null,
            streak: 0,
            total_easy: 0,
            total_medium: 0,
            total_hard: 0,
          },
          { onConflict: "id" }
        )
        .select(PUBLIC_PROFILE_SELECT)
        .maybeSingle();

      if (!insertErr && inserted) {
        createdProfile = inserted as Profile;
        break;
      }
    }

    if (!createdProfile) {
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: createdProfile }, { status: 201 });
  } catch (err) {
    console.error("Profile creation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const OBJECTIVES = ["internship", "fulltime", "consistency"] as const;

// Narrow, whitelisted preference updates. Deliberately NOT a generic profile
// editor: stats, handles and squad membership are all server-derived, and a
// blanket PATCH would be an open self-privilege-escalation surface.
export async function PATCH(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authed = await getAuthedUserId(request);
  if ("error" in authed) {
    return NextResponse.json({ error: authed.error }, { status: 401 });
  }
  const { user } = authed;

  const parsed = await readJsonBounded<Record<string, unknown>>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  const body = (parsed.value ?? {}) as Record<string, unknown>;
  const patch: Record<string, string> = {};

  if (typeof body.objective === "string") {
    const value = body.objective.trim().toLowerCase();
    if (value && !(OBJECTIVES as readonly string[]).includes(value)) {
      return NextResponse.json(
        { error: `Objective must be one of: ${OBJECTIVES.join(", ")}` },
        { status: 400 }
      );
    }
    if (value) patch.objective = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update. Supported fields: objective" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select(PUBLIC_PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't save that. Retry." }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}
