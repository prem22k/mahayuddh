import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServiceClient } from "@/lib/supabase/service";
import { safeNext } from "@/lib/safeNext";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { ApproachHeaderCard, CoreIdeaCard, ApproachDetails } from "@/components/approach/ApproachParts";
import { ApproachCode } from "@/components/approach/ApproachCode";
import { pickSolveProof, type SolveProof } from "@/components/approach/solveProof";
import type { Approach, Problem, ProblemEvent } from "@/types/database";

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
  | {
      status: "public";
      approach: Approach & { fork_count?: number | null };
      authorName: string;
      authorAvatar: string | null;
      problemTitle: string;
      problem: Pick<Problem, "title" | "difficulty" | "question_id"> | null;
      proof: SolveProof | null;
    };

async function load(id: string): Promise<LoadResult> {
  const supabase = getServiceClient();
  if (!supabase) return { status: "missing" };

  const { data: approach } = await supabase
    .from("approaches")
    .select(
      "id,user_id,problem_slug,pattern,core_idea,complexity_time,complexity_space,key_detail,edge_cases,mistakes,code,related_slugs,visibility,squad_id,fork_of,fork_count,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!approach) return { status: "missing" };
  if ((approach as Approach).visibility !== "public") return { status: "private" };

  const row = approach as Approach & { fork_count?: number | null };
  // The author's own solve events carry kind + duration only (no private
  // content), the same rows the member page reads for its proof box.
  const [authorRes, problemRes, eventsRes] = await Promise.all([
    supabase.from("profiles").select("username,avatar_url").eq("id", row.user_id).maybeSingle(),
    supabase
      .from("problems")
      .select("title_slug,title,difficulty,question_id,topics")
      .eq("title_slug", row.problem_slug.toLowerCase())
      .maybeSingle(),
    supabase
      .from("problem_events")
      .select("kind,duration_sec,metadata")
      .eq("user_id", row.user_id)
      .eq("problem_slug", row.problem_slug.toLowerCase())
      .eq("kind", "solved")
      .limit(50),
  ]);
  const author = authorRes.data as { username: string; avatar_url: string | null } | null;
  const problem = problemRes.data as Problem | null;

  return {
    status: "public",
    approach: row,
    authorName: author?.username ?? "Someone",
    authorAvatar: author?.avatar_url ?? null,
    problemTitle: problem?.title ?? prettify(row.problem_slug),
    problem,
    proof: eventsRes.error
      ? null
      : pickSolveProof((eventsRes.data ?? []) as Pick<ProblemEvent, "kind" | "duration_sec" | "metadata">[]),
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

  const { approach, authorName, authorAvatar, problemTitle, problem, proof } = found;
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

      <main className="mx-auto flex w-full max-w-reading flex-col gap-5 px-4 pb-16 pt-6 md:gap-6">
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

        <ApproachHeaderCard
          username={authorName}
          avatarUrl={authorAvatar}
          visibility={approach.visibility}
          createdAt={approach.created_at}
          forkCount={approach.fork_count ?? null}
          problem={{
            number: problem?.question_id || null,
            title: problemTitle,
            difficulty: problem?.difficulty ?? null,
            href: `/practice/${approach.problem_slug}`,
          }}
          pattern={approach.pattern}
          proof={proof}
        />

        <CoreIdeaCard text={approach.core_idea} />

        <ApproachDetails
          time={approach.complexity_time}
          space={approach.complexity_space}
          keyDetail={approach.key_detail}
          edgeCases={approach.edge_cases}
          mistakes={approach.mistakes}
        />

        {/* A shared approach is meant to be read: the code is open here. */}
        {approach.code && <ApproachCode code={approach.code} spoiler={false} />}

        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:p-4">
          <ShareRow
            path={artifactPath}
            artifact={{ kind: "approach", id }}
            text={shareText}
            label="Share"
          />
          <Link
            href={`/login?mode=signup&next=${nextParam}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            Start your squad
          </Link>
        </div>
      </main>
    </div>
  );
}
