import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServiceClient } from "@/lib/supabase/service";
import { safeNext } from "@/lib/safeNext";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";
import type { Approach, Problem } from "@/types/database";

/**
 * Public approach projection (Wave D growth).
 *
 * Pattern after /b/[id]: the service client reads only visibility=public
 * rows (code included — a shared approach is meant to be read), never squad
 * or private rows. Private rows redirect to login rather than 404ing, so a
 * logged-out visitor with a stale link lands on auth with ?next= back here;
 * UUIDs are unguessable, so the redirect is the only oracle and reveals
 * nothing enumerable. Missing rows 404.
 */

export const dynamic = "force-dynamic";

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type LoadResult =
  | { status: "missing" }
  | { status: "private" }
  | { status: "public"; approach: Approach; authorName: string; problemTitle: string };

async function load(id: string): Promise<LoadResult> {
  const supabase = getServiceClient();
  if (!supabase) return { status: "missing" };

  const { data: approach } = await supabase
    .from("approaches")
    .select(
      "id,user_id,problem_slug,pattern,core_idea,complexity_time,complexity_space,key_detail,edge_cases,mistakes,code,related_slugs,visibility,squad_id,fork_of,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!approach) return { status: "missing" };
  if ((approach as Approach).visibility !== "public") return { status: "private" };

  const row = approach as Approach;
  const [authorRes, problemRes] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", row.user_id).maybeSingle(),
    supabase
      .from("problems")
      .select("title_slug,title,difficulty,topics")
      .eq("title_slug", row.problem_slug.toLowerCase())
      .maybeSingle(),
  ]);

  return {
    status: "public",
    approach: row,
    authorName: (authorRes.data as { username: string } | null)?.username ?? "Someone",
    problemTitle: (problemRes.data as Problem | null)?.title ?? prettify(row.problem_slug),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await load(id);
  if (found.status !== "public") return { title: "Approach | Mahayuddh", robots: { index: false } };
  const hook = found.approach.core_idea.split("\n")[0]?.slice(0, 160) ?? "";
  return {
    title: `${found.problemTitle} approach by @${found.authorName} | Mahayuddh`,
    description: hook,
    openGraph: {
      title: `${found.problemTitle} approach by @${found.authorName}`,
      description: hook,
    },
  };
}

export default async function PublicApproachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await load(id);
  if (found.status === "missing") notFound();
  if (found.status === "private") {
    redirect(`/login?next=${encodeURIComponent(safeNext(`/a/${id}`) ?? "/home")}`);
  }

  const { approach, authorName, problemTitle } = found;
  const artifactPath = `/a/${id}`;
  const nextParam = encodeURIComponent(safeNext(artifactPath) ?? "/home");
  const shareText = `@${authorName}'s approach to ${problemTitle} on Mahayuddh.\n${approach.core_idea.split("\n")[0] ?? ""}`.trim();

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="mx-auto flex h-14 w-full max-w-reading items-center justify-between px-4">
        <Link href="/welcome" className="font-display text-lg font-semibold tracking-tight">
          Mahayuddh
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/login?next=${nextParam}`}
            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          >
            Sign in
          </Link>
          <Link
            href={`/login?mode=signup&next=${nextParam}`}
            className="inline-flex min-h-[44px] items-center rounded-md bg-surface-overlay px-4 text-sm font-medium text-text-primary hover:bg-surface-raised"
          >
            Start your squad
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-reading space-y-6 px-4 pb-16 pt-6">
        <Suspense fallback={null}>
          <TrackVisit artifact={`approach:${id}`} />
        </Suspense>

        <nav aria-label="Breadcrumb">
          <Link
            href={`/practice/${approach.problem_slug}`}
            className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary"
          >
            Practice / {problemTitle} / @{authorName}&rsquo;s approach
          </Link>
        </nav>

        <header className="space-y-2">
          <p className="text-sm leading-6 text-text-secondary">
            @{authorName} ·{" "}
            {new Date(approach.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
          <h1 className="type-display-md text-text-primary">{problemTitle}</h1>
          {approach.pattern && (
            <p className="text-sm leading-6 text-text-secondary">{approach.pattern}</p>
          )}
        </header>

        <section aria-label="Core idea" className="card">
          <h2 className="text-xs font-medium leading-4 text-text-tertiary">Core idea</h2>
          <p className="mt-2 whitespace-pre-wrap text-[17px] leading-7 text-text-primary">
            {approach.core_idea}
          </p>
        </section>

        {(approach.complexity_time || approach.complexity_space) && (
          <p className="font-mono text-sm leading-6 text-text-tertiary">
            {approach.complexity_time || "?"} · {approach.complexity_space || "?"}
          </p>
        )}
        {approach.key_detail && (
          <p className="text-[15px] leading-6 text-text-primary">{approach.key_detail}</p>
        )}
        {approach.edge_cases && (
          <p className="text-[15px] leading-6 text-text-secondary">{approach.edge_cases}</p>
        )}
        {approach.mistakes && (
          <p className="text-[15px] leading-6 text-text-secondary">{approach.mistakes}</p>
        )}
        {approach.code && (
          <section aria-label="Code" className="rounded-xl border border-hairline bg-well p-4">
            <pre className="overflow-x-auto font-mono text-sm leading-6 text-text-primary">
              <code>{approach.code}</code>
            </pre>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ShareRow
            path={artifactPath}
            artifact={{ kind: "approach", id }}
            text={shareText}
            label="Share"
          />
          <Link
            href={`/login?mode=signup&next=${nextParam}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
          >
            Start your squad
          </Link>
        </div>
      </main>
    </div>
  );
}
