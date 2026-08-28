import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// CORS headers to allow 1-click sync from leetcode.com bookmarklet / client script
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mahayuddh-token",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const customToken = request.headers.get("x-mahayuddh-token");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || customToken;

  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = getServiceClient();

  if (!anonUrl || !anonKey || !supabase) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: corsHeaders }
    );
  }

  let userId: string | null = null;

  if (token) {
    const userClient = createClient(anonUrl, anonKey, { auth: { persistSession: false } });
    const { data } = await userClient.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  if (!userId) {
    try {
      const serverSupabase = await createServerClient();
      const { data } = await serverSupabase.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch {
      // ignore
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized. Provide your Mahayuddh auth token." },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const slugs: string[] = Array.isArray(body.slugs) ? body.slugs : [];

    if (slugs.length === 0) {
      return NextResponse.json(
        { error: "No problem slugs provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    const uniqueSlugs = Array.from(
      new Set(slugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean))
    );

    // Upsert into user_problem_status in batches
    const CHUNK = 300;
    let totalImported = 0;

    for (let i = 0; i < uniqueSlugs.length; i += CHUNK) {
      const chunk = uniqueSlugs.slice(i, i + CHUNK);
      const rows = chunk.map((slug) => ({
        user_id: userId,
        problem_slug: slug,
        status: "solved",
        solved_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase
        .from("user_problem_status")
        .upsert(rows, { onConflict: "user_id,problem_slug" });

      if (!upsertErr) {
        totalImported += chunk.length;
      } else {
        console.error("Solved slugs upsert error:", upsertErr);
      }
    }

    return NextResponse.json(
      { success: true, imported: totalImported, total: uniqueSlugs.length },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("Solved slugs import error:", err);
    return NextResponse.json(
      { error: "Failed to import solved slugs" },
      { status: 500, headers: corsHeaders }
    );
  }
}
