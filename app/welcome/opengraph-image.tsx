import { ImageResponse } from "next/og";

export const alt = "Mahayuddh — practice DSA with your people";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Welcome OG card: the LinkedIn unfurl.
 *
 * A founder post lives or dies on this rectangle. It carries the promise in
 * the product's own voice and visual language (rose accent, glass card, mono
 * metrics) — never a generic gradient with a logo. Anyone who has never heard
 * of Mahayuddh should understand the offer from this image alone.
 */
export default async function WelcomeOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 55%, #1c0f12 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#fa586a" }}>
            DEVELOPER SQUAD ARENA
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#ffffff", lineHeight: 1.02 }}>
            Practice DSA with your people.
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.66)", lineHeight: 1.35 }}>
            Battle one problem. See how your squad thinks. Challenge them.
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#ffffff",
                background: "#d60017",
                borderRadius: 9999,
                paddingLeft: 36,
                paddingRight: 36,
                paddingTop: 16,
                paddingBottom: 16,
              }}
            >
              Start solo
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "rgba(255,255,255,0.85)",
                border: "2px solid rgba(255,255,255,0.25)",
                borderRadius: 9999,
                paddingLeft: 36,
                paddingRight: 36,
                paddingTop: 16,
                paddingBottom: 16,
              }}
            >
              Explore demo squad
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: 380,
            background: "rgba(28,28,30,0.85)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 28,
            padding: 36,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: "#fa586a" }}>
            TODAY&apos;S BATTLE
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#ffffff" }}>Two Sum</div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.6)" }}>Easy · Arrays</div>
          <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#ffffff", fontFamily: "monospace" }}>
                10:40
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)" }}>solved</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#ffffff", fontFamily: "monospace" }}>
                12d
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)" }}>streak</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#ffffff", fontFamily: "monospace" }}>
                3
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)" }}>battling</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
