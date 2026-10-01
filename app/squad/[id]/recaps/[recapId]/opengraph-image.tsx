import { ImageResponse } from "next/og";
import { getPublicRecap } from "@/lib/data/recapPublic";

export const alt = "A weekly squad practice recap on Mahayuddh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Recap OG card (Step 20).
 *
 * Includes the week and the headline verbatim. A share preview that omits
 * "A quiet week" would be a recruiting poster for a lie.
 */
export default async function RecapOpengraphImage({
  params,
}: {
  params: { id: string; recapId: string };
}) {
  const found = await getPublicRecap(params.id, params.recapId);
  const body = found?.recap.body_json;

  const cells = body
    ? [
        { label: "SOLVES", value: String(body.solves) },
        { label: "CHALLENGES", value: String(body.challengesSent) },
        { label: "ANSWERED", value: String(body.challengesCompleted) },
        { label: "APPROACHES", value: String(body.approachesWritten) },
        { label: "STUCK ASKS", value: String(body.stuckRequests) },
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
            WEEKLY RECAP
          </div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.45)" }}>
            {body?.window?.weekStart ?? ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            {found?.squadName ?? "A squad"}
          </div>
          {body?.headline ? (
            <div style={{ fontSize: 34, color: "rgba(255,255,255,0.66)", lineHeight: 1.3 }}>
              {body.headline}
            </div>
          ) : null}
          {body?.empty?.length ? (
            <div style={{ fontSize: 24, color: "rgba(255,255,255,0.35)" }}>
              Did not happen: {body.empty[0]}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 36 }}>
          {cells.map((c) => (
            <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#ffffff" }}>{c.value}</div>
              <div style={{ fontSize: 19, letterSpacing: 2, color: "rgba(255,255,255,0.4)" }}>
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
