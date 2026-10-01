import type { Metadata } from "next";
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

export default function PrimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
