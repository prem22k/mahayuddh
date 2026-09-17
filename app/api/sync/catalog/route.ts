import { NextResponse } from "next/server";
import { getServiceClient, isAuthorizedCron, type ServiceClient } from "@/lib/supabase/service";
import { fetchFullProblemCatalog } from "@/lib/leetcode";

async function upsertCatalog(supabase: ServiceClient) {
  const { problems: catalog, complete } = await fetchFullProblemCatalog();
  if (catalog.length === 0) {
    return { total: 0, synced: 0, complete };
  }

  const rows = catalog.map((p) => ({
    title_slug: p.titleSlug,
    title: p.title,
    difficulty: p.difficulty,
    question_id: p.questionFrontendId,
    paid_only: !!p.paidOnly,
    topics: p.topicTags.map((t: { name: string }) => t.name),
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

  // Partial pulls never masquerade as complete: sync_state only advances
  // on a full walk, so the UI can't mistake a throttled page for "empty catalog".
  if (complete) {
    await supabase
      .from("catalog_sync_state")
      .upsert({ id: 1, last_synced_at: new Date().toISOString(), total_count: catalog.length });
  }

  return { total: catalog.length, synced: rows.length, complete };
}

export async function POST(request: Request) {
  return handleCatalogSync(request);
}

// Reads must never mutate the shared problem catalog (cron uses POST).
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}

async function handleCatalogSync(request: Request) {
  if (!isAuthorizedCron(request)) {
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
    return NextResponse.json({ error: "Catalog sync failed" }, { status: 500 });
  }
}
