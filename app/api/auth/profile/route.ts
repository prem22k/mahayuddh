import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = getServiceClient();

  if (!anonUrl || !anonKey || !supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  // Validate the user from the Supabase JWT
  const userClient = createClient(anonUrl, anonKey, { auth: { persistSession: false } });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Check if profile already exists
    const { data: existingProfile, error: fetchErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!fetchErr && existingProfile) {
      return NextResponse.json({ profile: existingProfile as Profile });
    }

    // 2. Profile missing: auto-create safely using service role
    let baseUsername =
      user.user_metadata?.username ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Squad Member";

    baseUsername = baseUsername.trim().slice(0, 30);
    if (!baseUsername) baseUsername = "Squad_Member";

    const leetcodeUsername = user.user_metadata?.leetcode_username || null;
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
            leetcode_username: leetcodeUsername,
            avatar_url: avatarUrl,
            contest_rating: 1500,
            streak: 0,
            total_easy: 0,
            total_medium: 0,
            total_hard: 0,
          },
          { onConflict: "id" }
        )
        .select()
        .maybeSingle();

      if (!insertErr && inserted) {
        createdProfile = inserted as Profile;
        break;
      }
    }

    if (!createdProfile) {
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: createdProfile });
  } catch (err) {
    console.error("Profile resolution error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
