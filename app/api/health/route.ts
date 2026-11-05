import { NextResponse } from "next/server";
import { PUBLIC_PROFILE_COLUMNS, OWN_PROFILE_COLUMNS } from "@/lib/data/profileColumns";
import { classifySchemaError, combineSchemaStates, type SchemaState } from "@/lib/health/schemaCheck";

// GET /api/health — no auth.
//
// Liveness probe for the 5-minute GitHub probe workflow and for the
// /offline failover hub's auto-retry. Returns
// { ok: true, db: "up" | "down", schema: "ok" | "mismatch" | "unknown" }.
//
// db:     a single cheap head-count query on profiles with a short timeout.
//         The HTTP status follows db only (200 up, 503 down), because the
//         probe wakes the Render backup on a 503 and Render's own checks
//         match it.
// schema: zero-row selects of every profiles column the app reads, as anon
//         (public columns: existence and grants) and with the service role
//         (the signed-in user's own columns: existence). "mismatch" means
//         the deployed code selects something production doesn't have,
//         which breaks signed-in pages while db stays "up"; a backup on the
//         same database can't fix that, so it never changes the status code.
//         The probe opens a separate [schema] issue for it.
// Never leaks details: errors collapse to the three words, with no message.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return NextResponse.json({ ok: true, db: "down", schema: "unknown" }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(url, key, { auth: { persistSession: false } });
    const service = serviceKey
      ? createClient(url, serviceKey, { auth: { persistSession: false } })
      : null;

    const liveness = anon
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    // limit(0): PostgREST still resolves every column (and its grant) but
    // returns no rows, so the check reads no data.
    const publicColumns = anon.from("profiles").select(PUBLIC_PROFILE_COLUMNS).limit(0);
    const ownColumns = service
      ? service.from("profiles").select(OWN_PROFILE_COLUMNS).limit(0)
      : null;

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("health timeout")), TIMEOUT_MS);
    });
    const [live, pub, own] = (await Promise.race([
      Promise.all([liveness, publicColumns, ownColumns]),
      timeout,
    ])) as [
      { error?: unknown },
      { error?: { code?: string } | null },
      { error?: { code?: string } | null } | null,
    ];

    if (live && live.error) {
      return NextResponse.json({ ok: true, db: "down", schema: "unknown" }, { status: 503 });
    }
    const states: SchemaState[] = [classifySchemaError(pub?.error)];
    if (own) states.push(classifySchemaError(own.error));
    return NextResponse.json({ ok: true, db: "up", schema: combineSchemaStates(states) });
  } catch {
    return NextResponse.json({ ok: true, db: "down", schema: "unknown" }, { status: 503 });
  }
}
