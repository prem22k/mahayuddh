import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchFullProblemCatalog } from "@/lib/leetcode";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function upsertCatalog(supabase: NonNullable<ReturnType<typeof getServiceClient>>) {
  const catalog = await fetchFullProblemCatalog();
  if (catalog.length === 0) {
    return { total: 0, synced: 0 };
  }

  const rows = catalog.map((p) => ({
    title_slug: p.titleSlug,
    title: p.title,
    difficulty: p.difficulty,
    question_id: p.questionFrontendId,
    paid_only: !!p.paidOnly,
    topics: p.topicTags.map((t) => t.name),
    updated_at: new Date().toISOString(),
  }));

  // Upsert in chunks to stay within payload limits.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("problems")
      .upsert(slice, { onConflict: "title_slug" });
    if (error) {
      console.error("Catalog upsert error:", error);
      throw error;
    }
  }

  await supabase
    .from("catalog_sync_state")
    .upsert({ id: 1, last_synced_at: new Date().toISOString(), total_count: catalog.length });

  return { total: catalog.length, synced: rows.length };
}

export async function POST(request: Request) {
  return handleCatalogSync(request);
}

export async function GET(request: Request) {
  return handleCatalogSync(request);
}

async function handleCatalogSync(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = authHeader?.replace(/^Bearer\s+/i, "");
  const urlObj = new URL(request.url);
  const queryKey = urlObj.searchParams.get("key");

  if (
    process.env.CRON_SECRET &&
    cronSecret !== process.env.CRON_SECRET &&
    queryKey !== process.env.CRON_SECRET &&
    process.env.NODE_ENV === "production"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role client not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await upsertCatalog(supabase);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Catalog sync failed:", error);
    return NextResponse.json(
      { error: "Catalog sync failed", details: String(error) },
      { status: 500 }
    );
  }
}
