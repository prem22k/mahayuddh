import { profileHref } from "@/lib/profiles/username";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { decodePathSegment } from "@/lib/pathSegment";
import { safeNext } from "@/lib/safeNext";
import type { Metadata } from "next";
import { getPublicJourney } from "@/lib/data/journey.server";
import { getPublicProfile } from "@/lib/data/profilePublic";
import { getServiceClient } from "@/lib/supabase/service";
import { pickSolveProof } from "@/components/approach/solveProof";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { PublicPortfolio } from "@/components/profile/PublicPortfolio";
import type { ProblemMeta, SolveProof } from "@/components/profile/portfolio";
import { monthYear } from "@/components/proof/stamp";
import type { Approach, ProblemEvent } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Public portfolio (Step 22).
 *
 * Identity header beside a featured Pass, five dimension rows with evidence,
 * public teaching tabs, and a quiet visitor close. No scores, no radar, no
 * badge walls.
 */
async function load(username: string) {
  const [profile, journey] = await Promise.all([
    getPublicProfile(username),
    getPublicJourney(username, 30),
  ]);
  if (!profile) return null;
  return { profile, journey };
}

/**
 * Facts the Stitch rows show beside each public approach, at the same
 * exposure /a/[id] already has: the catalog row (title, difficulty, number)
 * and the author's own solve events for that problem (kind + duration +
 * sync source, no content). Plus the profile's avatar and join month.
 * Any failed read just leaves its field out — never a stand-in value.
 */
async function loadExtras(userId: string, approaches: Approach[]) {
  const empty = {
    avatarUrl: null as string | null,
    memberSince: null as string | null,
    problems: {} as Record<string, ProblemMeta>,
    proofs: {} as Record<string, SolveProof>,
  };
  const supabase = getServiceClient();
  if (!supabase) return empty;

  const slugs = Array.from(new Set(approaches.map((a) => a.problem_slug.toLowerCase())));
  const [profileRes, catalogRes, eventsRes] = await Promise.all([
    supabase.from("profiles").select("avatar_url,created_at").eq("id", userId).maybeSingle(),
    slugs.length > 0
      ? supabase.from("problems").select("title_slug,title,difficulty,question_id").in("title_slug", slugs)
      : Promise.resolve({ data: [], error: null }),
    slugs.length > 0
      ? supabase
          .from("problem_events")
          .select("problem_slug,kind,duration_sec,metadata")
          .eq("user_id", userId)
          .eq("kind", "solved")
          .in("problem_slug", slugs)
          .limit(600)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileRow = profileRes.data as { avatar_url: string | null; created_at: string | null } | null;

  const problems: Record<string, ProblemMeta> = {};
  for (const r of (catalogRes.data ?? []) as {
    title_slug: string;
    title: string;
    difficulty: string | null;
    question_id: string | number | null;
  }[]) {
    problems[r.title_slug.toLowerCase()] = {
      title: r.title,
      difficulty: r.difficulty ?? null,
      questionId: r.question_id ? String(r.question_id) : null,
    };
  }

  const proofs: Record<string, SolveProof> = {};
  if (!eventsRes.error) {
    const bySlug = new Map<string, Pick<ProblemEvent, "kind" | "duration_sec" | "metadata">[]>();
    for (const e of (eventsRes.data ?? []) as (Pick<ProblemEvent, "kind" | "duration_sec" | "metadata"> & {
      problem_slug: string;
    })[]) {
      const key = e.problem_slug.toLowerCase();
      bySlug.set(key, [...(bySlug.get(key) ?? []), e]);
    }
    for (const [slug, rows] of bySlug) {
      const proof = pickSolveProof(rows);
      if (proof) proofs[slug] = proof;
    }
  }

  return {
    avatarUrl: profileRow?.avatar_url ?? null,
    memberSince: monthYear(profileRow?.created_at),
    problems,
    proofs,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodePathSegment(raw);
  const found = await load(username);
  if (!found) return { title: `${username} | Mahayuddh`, robots: { index: false } };
  const teaches = found.profile.stats?.frequent_patterns ?? [];
  const desc = found.journey?.summary ?? (teaches.length > 0 ? `Teaches ${teaches.slice(0, 3).join(", ")}.` : "");
  return {
    title: `${found.profile.stats?.username ?? username} | Mahayuddh`,
    description: desc,
    openGraph: { title: `@${found.profile.stats?.username ?? username} on Mahayuddh`, description: desc },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const username = decodePathSegment(raw);
  const found = await load(username);
  if (!found) notFound();
  const { profile, journey } = found;

  const handle = profile.stats?.username ?? username;
  const displayName =
    handle.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || handle;
  const extras = await loadExtras(profile.userId, profile.approaches);

  // Deep-continue (Wave D): visitor CTAs carry ?next=<artifact> through
  // safeNext so auth lands back on this profile. Login already honors ?next=.
  const artifactPath = profileHref(handle);
  const nextParam = encodeURIComponent(safeNext(artifactPath) ?? "/home");
  const shareText = journey?.summary ?? `Follow @${handle} on Mahayuddh.`;

  return (
    <>
      <Suspense fallback={null}>
        <TrackVisit artifact={`journey:${handle}`} />
      </Suspense>
      <PublicPortfolio
        handle={handle}
        displayName={displayName}
        userId={profile.userId}
        avatarUrl={extras.avatarUrl}
        memberSince={extras.memberSince}
        stats={profile.stats}
        journey={journey}
        approaches={profile.approaches}
        primers={profile.primers}
        problems={extras.problems}
        proofs={extras.proofs}
        artifactPath={artifactPath}
        signInHref={`/login?next=${nextParam}`}
        signupHref={`/login?mode=signup&next=${nextParam}`}
        shareText={shareText}
      />
    </>
  );
}
