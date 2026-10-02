import { ImageResponse } from "next/og";
import { getPublicJourney } from "@/lib/data/journey";

export const alt = "A personal practice journey on Mahayuddh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Journey OG card (Step 20).
 *
 * Renders only what the public projection contains — counts and durations.
 * A crawler fetching this gets the same facts a visitor does, nothing more.
 */
export default async function JourneyOpengraphImage({
  params,
}: {
  params: { username: string };
}) {
  const journey = await getPublicJourney(params.username, 30);

  const cells = journey
    ? [
        { label: "BATTLES", value: String(journey.battlesStarted) },
        { label: "SOLVES", value: String(journey.solved) },
        { label: "PATTERNS", value: String(journey.patterns) },
        { label: "APPROACHES", value: String(journey.approachesWritten) },
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
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#fa586a" }}>
          LAST 30 DAYS
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            @{journey?.username ?? params.username}
          </div>
          {journey?.summary ? (
            <div style={{ fontSize: 30, color: "rgba(255,255,255,0.62)" }}>{journey.summary}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 40 }}>
          {cells.map((c) => (
            <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: "#ffffff" }}>{c.value}</div>
              <div style={{ fontSize: 20, letterSpacing: 2, color: "rgba(255,255,255,0.4)" }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
          Mahayuddh — practice DSA with your people
        </div>
      </div>
    ),
    { ...size }
  );
}