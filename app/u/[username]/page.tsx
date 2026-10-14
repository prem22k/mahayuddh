import { profileHref } from "@/lib/profiles/username";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { decodePathSegment } from "@/lib/pathSegment";
import { safeNext } from "@/lib/safeNext";
import type { Metadata } from "next";
import { getPublicJourney } from "@/lib/data/journey.server";
import { getPublicProfile } from "@/lib/data/profilePublic";
import { formatDuration } from "@/lib/format";
import { oftenTeaches, reputationDimensions } from "@/lib/reputation";
import { ShareRow } from "@/components/ui/ShareRow";
import { PostKit } from "@/components/ui/PostKit";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { FollowButton } from "@/components/profile/FollowButton";
import { PublicProfileBody } from "@/components/profile/PublicProfileBody";
import { Avatar } from "@/components/ui/Avatar";
import { Pass, PassSerial } from "@/components/pass/Pass";

export const dynamic = "force-dynamic";

/**
 * Public portfolio (Step 22).
 *
 * Identity header beside a featured Proof card, five dimension rows with
 * evidence, public teaching tabs, and a quiet visitor close. No scores,
 * no radar, no badge walls.
 */
async function load(username: string) {
  const [profile, journey] = await Promise.all([
    getPublicProfile(username),
    getPublicJourney(username, 30),
  ]);
  if (!profile) return null;
  return { profile, journey };
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
  const dimensions = profile.stats ? reputationDimensions(profile.stats) : [];
  const teaches = oftenTeaches(profile.stats?.frequent_patterns ?? []);

  const displayName =
    handle.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || handle;
  const featured = profile.approaches[0] ?? null;

  // Deep-continue (Wave D): visitor CTAs carry ?next=<artifact> through
  // safeNext so auth lands back on this profile. Login already honors ?next=.
  const artifactPath = profileHref(handle);
  const nextParam = encodeURIComponent(safeNext(artifactPath) ?? "/home");
  const shareText = journey?.summary ?? `Follow @${handle} on Mahayuddh.`;

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="flex h-14 items-center justify-between px-4 md:px-10">
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
            className="inline-flex min-h-[44px] items-center rounded-md bg-surface-overlay px-4 text-sm font-medium text-text-primary hover:bg-[#272830]"
          >
            Start your squad
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content px-4 pb-16 pt-6 md:px-10">
        <Suspense fallback={null}>
          <TrackVisit artifact={`journey:${handle}`} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-[55%_45%] lg:items-start">
          <div className="space-y-3">
            <Avatar name={displayName} size="xl" />
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
              {displayName}
            </h1>
            <p className="font-mono text-sm text-text-tertiary">@{handle}</p>
            {teaches.length > 0 && (
              <p className="text-sm leading-6 text-text-secondary">
                Often teaches{" "}
                {teaches.map((t, i) => (
                  <span key={t}>
                    <Link
                      href={`/patterns/${encodeURIComponent(t)}`}
                      className="text-text-primary underline decoration-hairline-strong underline-offset-4 hover:decoration-text-primary"
                    >
                      {t}
                    </Link>
                    {i < teaches.length - 1 ? " and " : ""}
                  </span>
                ))}
                .
              </p>
            )}
            {journey && (
              <p className="text-sm leading-6 text-text-secondary">{journey.summary}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <FollowButton userId={profile.userId} username={handle} />
              <ShareRow
                path={profileHref(handle)}
                artifact={{ kind: "journey", id: handle }}
                text={shareText}
                label="Share"
              />
              <PostKit
                imageHref={`/u/${encodeURIComponent(handle)}/opengraph-image`}
                path={artifactPath}
                artifact={{ kind: "journey", id: handle }}
                text={shareText}
              />
            </div>
          </div>

          <div>
            {featured ? (
              <Pass
                body={
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-text-secondary">Featured proof</p>
                    <p className="font-display text-2xl font-semibold capitalize tracking-tight">
                      {featured.problem_slug.replace(/-/g, " ")}
                    </p>
                    <p className="line-clamp-3 text-sm leading-6 text-text-secondary">
                      {featured.core_idea}
                    </p>
                    <Link
                      href={`/a/${featured.id}`}
                      className="inline-flex min-h-[44px] items-center rounded-md bg-surface-overlay px-4 text-sm font-medium text-text-primary hover:bg-[#272830]"
                    >
                      Read the approach
                    </Link>
                  </div>
                }
                stub={
                  <>
                    <PassSerial>@{handle}</PassSerial>
                    {featured.pattern && <PassSerial>{featured.pattern}</PassSerial>}
                    <PassSerial>Verified practice</PassSerial>
                  </>
                }
              />
            ) : (
              <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
                <p className="text-sm font-medium text-text-primary">No verified solves yet</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  When @{handle} verifies a solve, the proof card shows up here.
                </p>
              </div>
            )}
          </div>
        </div>

        {dimensions.length > 0 && (
          <section className="mx-auto mt-10 w-full max-w-reading space-y-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Proof of practice</h2>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
              {dimensions.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{d.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-text-tertiary">{d.definition}</p>
                    {d.note && <p className="mt-0.5 text-xs leading-5 text-text-secondary">{d.note}</p>}
                  </div>
                  <span className="shrink-0 font-display text-2xl font-semibold tnum">
                    {d.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mx-auto mt-8 w-full max-w-reading">
          <PublicProfileBody approaches={profile.approaches} primers={profile.primers} />
        </div>

        {journey?.medianSolveSec != null && (
          <p className="mx-auto mt-6 w-full max-w-reading text-xs leading-5 text-text-tertiary">
            Median solve {formatDuration(journey.medianSolveSec)} over the last 30 days.
          </p>
        )}

        <section className="mx-auto mt-10 w-full max-w-reading rounded-xl border border-hairline bg-surface p-8 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Practice with your own people
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            One problem a day, timed and verified. Your squad sees who solved it and how
            they thought about it.
          </p>
          <Link
            href={`/login?mode=signup&next=${nextParam}`}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed"
          >
            Start your squad
          </Link>
        </section>
      </main>
    </div>
  );
}
