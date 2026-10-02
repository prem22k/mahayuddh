import { ImageResponse } from "next/og";
import { getSeasonResult } from "@/lib/data/seasonResult";

export const alt = "A squad season result on Mahayuddh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Season OG card (§38).
 *
 * The headline is rendered verbatim, including the version that says nobody
 * challenged anybody. A preview that only ever shows the flattering number is
 * how a squad ends up advertising a loop that did not run.
 */
export default async function SeasonOpengraphImage({
  params,
}: {
  params: { id: string; seasonId: string };
}) {
  const result = await getSeasonResult(params.id, params.seasonId);

  const cells = result
    ? [
        { label: "SOLVES", value: String(result.solves) },
        { label: "PROBLEMS", value: String(result.problems) },
        { label: "CHALLENGES", value: String(result.challengesSent) },
        { label: "ANSWERED", value: String(result.challengesCompleted) },
        { label: "APPROACHES", value: String(result.approachesWritten) },
      ]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 55%, #1c0f12 100%)",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#fa586a" }}>
            SEASON RESULT
          </div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.45)" }}>
            {result?.startsAt ?? ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 62, fontWeight: 800, color: "#ffffff", lineHeight: 1.06 }}>
            {result?.squadName ?? "A squad"}
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.7)" }}>{result?.name ?? ""}</div>
          {result?.headline ? (
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>
              {result.headline}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 32 }}>
          {cells.map((c) => (
            <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#ffffff" }}>{c.value}</div>
              <div style={{ fontSize: 18, letterSpacing: 2, color: "rgba(255,255,255,0.4)" }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 25, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
          Mahayuddh — practice DSA with your people
        </div>
      </div>
    ),
    { ...size }
  );
}
