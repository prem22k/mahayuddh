import { profileHref } from "@/lib/profiles/username";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { decodePathSegment } from "@/lib/pathSegment";
import type { Metadata } from "next";
import { getPublicJourney } from "@/lib/data/journey";
import { getPublicProfile } from "@/lib/data/profilePublic";
import { formatDuration } from "@/lib/format";
import { oftenTeaches, reputationDimensions } from "@/lib/reputation";
import { ShareRow } from "@/components/ui/ShareRow";
import { TrackVisit } from "@/components/ui/TrackVisit";
import { FollowButton } from "@/components/profile/FollowButton";
import { PublicProfileBody } from "@/components/profile/PublicProfileBody";

export const dynamic = "force-dynamic";

/**
 * Public profile (Step 22, Bible §21/§22).
 *
 * Journey header from Step 20, then the five §22 dimensions, then their public
 * teaching. §21 asks for "useful to learn from" rather than "most followers",
 * so this page leads with what somebody wrote and whether anyone used it.
 *
 * There is no overall score anywhere on this page, and
 * lib/reputation.ts has no function that would produce one. §22 says a single
 * score creates false precision and invites gaming, so the ban is structural.
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
  // Next hands the segment over still encoded: "/u/Prem%20Sai" arrives as
  // "Prem%20Sai". Looked up as-is it finds nothing and the page 404s for any
  // handle with a space, a percent, a plus or any non-ASCII character.
  const username = decodePathSegment(raw);
  const found = await load(username);
  if (!found) notFound();
  const { profile, journey } = found;

  const handle = profile.stats?.username ?? username;
  const dimensions = profile.stats ? reputationDimensions(profile.stats) : [];
  const teaches = oftenTeaches(profile.stats?.frequent_patterns ?? []);

  const stats: { label: string; value: string }[] = journey
    ? [
        { label: "Battles", value: String(journey.battlesStarted) },
        { label: "Solves", value: String(journey.solved) },
        { label: "Patterns", value: String(journey.patterns) },
        { label: "Active days", value: String(journey.activeDays) },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#000] text-white">
      <div className="max-w-2xl mx-auto px-5 py-14 space-y-8">
        <Suspense fallback={null}>
          <TrackVisit artifact={`journey:${handle}`} />
        </Suspense>

        <header className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">@{handle}</h1>

          {teaches.length > 0 && (
            <p className="text-sm text-white/55">
              Often teaches:{" "}
              {teaches.map((t, i) => (
                <span key={t}>
                  <Link href={`/patterns/${encodeURIComponent(t)}`} className="text-white/80 hover:text-white">
                    {t}
                  </Link>
                  {i < teaches.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          )}

          {journey && (
            <p className="text-sm text-white/50 leading-relaxed">{journey.summary}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <FollowButton userId={profile.userId} username={handle} />
            <ShareRow
              path={profileHref(handle)}
              artifact={{ kind: "journey", id: handle }}
              text={journey?.summary ?? `Follow @${handle} on Mahayuddh.`}
              label="Share profile"
            />
          </div>
        </header>

        {stats.length > 0 && (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="text-2xl font-black font-mono">{s.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/35 mt-1">{s.label}</div>
              </div>
            ))}
          </dl>
        )}

        {/* §22 dimensions. Five separate counts, each stating what it counts.
            Deliberately not sorted by size and deliberately not summed. */}
        {dimensions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-bold">What they have done</h2>
            <p className="text-[11px] text-white/30">
              Five separate dimensions, not one number. A single score would imply a
              comparison that does not hold.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dimensions.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-bold text-white/80">{d.label}</span>
                    <span className="text-xl font-black font-mono text-white">{d.value}</span>
                  </div>
                  <p className="text-[10px] text-white/40">{d.definition}</p>
                  {d.note && <p className="text-[10px] text-white/25">{d.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <PublicProfileBody
          approaches={profile.approaches}
          primers={profile.primers}
        />

        {journey?.medianSolveSec != null && (
          <p className="text-[11px] text-white/30">
            Median solve {formatDuration(journey.medianSolveSec)} over the last 30 days.
          </p>
        )}
      </div>
    </div>
  );
}