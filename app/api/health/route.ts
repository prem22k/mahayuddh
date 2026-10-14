import { NextResponse } from "next/server";

// GET /api/health — no auth.
//
// Liveness probe for the 5-minute GitHub probe workflow and for the
// /offline failover hub's auto-retry. Returns { ok: true, db: "up" | "down" }
// via a single cheap head-count query on profiles with a short timeout.
// Never leaks details: errors collapse to db:"down" with no message.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ ok: true, db: "down" }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, { auth: { persistSession: false } });
    const query = client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("health timeout")), TIMEOUT_MS);
    });
    const result = (await Promise.race([query, timeout])) as {
      error?: unknown;
    };
    if (result && result.error) {
      return NextResponse.json({ ok: true, db: "down" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: true, db: "down" }, { status: 503 });
  }
}
