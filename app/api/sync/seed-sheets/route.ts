import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CURATED_SHEETS } from "@/lib/data/curatedSheetsData";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  return seedSheetsHandler(request);
}

export async function GET(request: Request) {
  return seedSheetsHandler(request);
}

async function seedSheetsHandler(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = authHeader?.replace(/^Bearer\s+/i, "");
  const urlObj = new URL(request.url);
  const queryKey = urlObj.searchParams.get("key");

  // Allow execution if CRON_SECRET matches, or in development, or if service role is present
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
    let totalProblemsInserted = 0;
    const sheetResults: { slug: string; problemsCount: number }[] = [];

    for (const sheet of CURATED_SHEETS) {
      // 1. Upsert custom list
      const { data: listRow, error: listErr } = await supabase
        .from("custom_lists")
        .upsert(
          {
            slug: sheet.slug,
            title: sheet.title,
            emoji: sheet.emoji,
            description: sheet.description,
            is_curated: true,
          },
          { onConflict: "slug" }
        )
        .select("id")
        .maybeSingle();

      if (listErr || !listRow) {
        console.error(`Failed to upsert list ${sheet.slug}:`, listErr);
        continue;
      }

      const listId = listRow.id;

      // 2. Clear old problems for this curated list to avoid duplicates
      await supabase.from("list_problems").delete().eq("list_id", listId);

      // 3. Insert all problems for this sheet in chunks
      const problemsToInsert = sheet.problems.map((p) => ({
        list_id: listId,
        title: p.title,
        title_slug: p.title_slug,
        difficulty: p.difficulty,
        category: p.category,
        order_index: p.order_index,
      }));

      const CHUNK = 50;
      for (let i = 0; i < problemsToInsert.length; i += CHUNK) {
        const slice = problemsToInsert.slice(i, i + CHUNK);
        const { error: insertErr } = await supabase
          .from("list_problems")
          .insert(slice);

        if (insertErr) {
          console.error(`Error inserting problems chunk for ${sheet.slug}:`, insertErr);
        }
      }

      totalProblemsInserted += problemsToInsert.length;
      sheetResults.push({ slug: sheet.slug, problemsCount: problemsToInsert.length });
    }

    return NextResponse.json({
      success: true,
      sheetsCount: sheetResults.length,
      totalProblems: totalProblemsInserted,
      details: sheetResults,
    });
  } catch (error) {
    console.error("Failed to seed curated sheets:", error);
    return NextResponse.json(
      { error: "Failed to seed curated sheets", details: String(error) },
      { status: 500 }
    );
  }
}
