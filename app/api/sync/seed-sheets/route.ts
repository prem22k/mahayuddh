import { NextResponse } from "next/server";
import { getServiceClient, isAuthorizedCron } from "@/lib/supabase/service";
import { CURATED_SHEETS } from "@/lib/data/curatedSheetsData";

export async function POST(request: Request) {
  return seedSheetsHandler(request);
}

// Reads must never mutate curated data.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}

async function seedSheetsHandler(request: Request) {
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

      // 2. Idempotent upsert (list_id, title_slug) unique: crash-safe,
      // no delete-then-insert window where readers see an empty list.
      const problemsToInsert = sheet.problems.map((p) => ({
        list_id: listId,
        title: p.title,
        title_slug: p.title_slug,
        difficulty: p.difficulty,
        category: p.category,
        order_index: p.order_index,
      }));

      const CHUNK = 50;
      let insertedForSheet = 0;
      for (let i = 0; i < problemsToInsert.length; i += CHUNK) {
        const slice = problemsToInsert.slice(i, i + CHUNK);
        const { error: insertErr } = await supabase
          .from("list_problems")
          .upsert(slice, { onConflict: "list_id,title_slug" });

        if (insertErr) {
          console.error(`Error upserting problems chunk for ${sheet.slug}:`, insertErr);
        } else {
          insertedForSheet += slice.length;
        }
      }

      totalProblemsInserted += insertedForSheet;
      sheetResults.push({ slug: sheet.slug, problemsCount: insertedForSheet });
    }

    return NextResponse.json({
      success: true,
      sheetsCount: sheetResults.length,
      totalProblems: totalProblemsInserted,
      details: sheetResults,
    });
  } catch (error) {
    console.error("Failed to seed curated sheets:", error);
    return NextResponse.json({ error: "Failed to seed curated sheets" }, { status: 500 });
  }
}
