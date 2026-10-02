import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/service";

// The primer page itself is a client component (it starts battles from the
// dock), so it cannot export metadata. This layout can: public primers are the
// indexable teaching surface (Bible §14), so they deserve real titles.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const title = humanize(rawSlug);

  try {
    const supabase = getServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("primers")
        .select("title, pattern, visibility")
        .eq("slug", rawSlug.toLowerCase())
        .eq("visibility", "public")
        .maybeSingle();
      if (data) {
        const row = data as { title: string; pattern: string };
        return {
          title: `${row.title} (${row.pattern})`,
          description: `A ${row.pattern} primer: when to recognise it, the mental model, a template, common mistakes, and three starter problems.`,
          openGraph: {
            title: `${row.title} — ${row.pattern} primer`,
            description: `Recognise it when, the mental model, a template, and three starter problems.`,
            type: "article",
          },
        };
      }
    }
  } catch {
    // Fall through to the generic title rather than failing the render.
  }

  return { title };
}

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * A primer slug that does not exist is a real 404, not a 200 with a spinner.
 *
 * The page is a client component so it can only say "not found" after
 * hydration — fine for a member mid-session, but these routes are public and
 * indexable, and a soft 404 is how a crawler ends up indexing every guessed
 * URL under /primers/.
 *
 * Only genuinely missing rows 404 here. A squad primer must still render for
 * its members, so existence is checked without the visibility filter; RLS
 * decides what a logged-out visitor can actually read.
 */
export default async function PrimerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let missing = false;
  try {
    const supabase = getServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("primers")
        .select("id")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();
      missing = !data;
    }
  } catch {
    // A lookup failure must not 404 a page that may well exist, so this leaves
    // `missing` false and renders normally.
  }

  // Outside the try, deliberately: notFound() signals by throwing, and the
  // catch above would swallow that throw and turn the 404 back into a 200.
  if (missing) notFound();

  return children;
}
