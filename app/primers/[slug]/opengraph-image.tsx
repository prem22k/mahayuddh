import { ImageResponse } from "next/og";
import { getPublicPrimer } from "@/lib/data/primersPublic";

export const alt = "A pattern primer on Mahayuddh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Primer OG card (Step 20).
 *
 * Squad primers fall through to a generic card. A crawler has no session, so
 * rendering a squad primer's title or pattern here would publish something the
 * squad deliberately kept inside the group.
 */
export default async function PrimerOpengraphImage({
  params,
}: {
  params: { slug: string };
}) {
  const primer = await getPublicPrimer(params.slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 55%, #12161c 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#F5B83D" }}>
          {primer ? primer.pattern.toUpperCase() : "PATTERN PRIMER"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 800, color: "#ffffff", lineHeight: 1.06 }}>
            {primer?.title ?? "A primer on Mahayuddh"}
          </div>
          {primer?.recognize_when?.length ? (
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)" }}>
              {primer.recognize_when[0]}
            </div>
          ) : (
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.45)" }}>
              Recognize it, model it, then solve it.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 40 }}>
          {primer?.starter_slugs?.slice(0, 3).map((s) => (
            <div
              key={s}
              style={{
                fontSize: 22,
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              {s}
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
