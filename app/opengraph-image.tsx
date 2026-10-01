import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";

// Default OG card for the app. Pulls real public primer titles so the card is a
// teaching signal, not a stock banner. SVG is not supported by satori, so this is
// plain JSX with system fonts.
export const alt = "Mahayuddh — practice DSA with your people";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  let primerNames: string[] = [];
  try {
    const supabase = getServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("primers")
        .select("title")
        .eq("visibility", "public")
        .order("created_at", { ascending: true })
        .limit(3);
      primerNames = ((data ?? []) as { title: string }[]).map((p) => p.title);
    }
  } catch {
    // A card that renders with static copy beats a 500.
  }

  const host = (process.env.NEXT_PUBLIC_SITE_URL || "mahayuddh.app").replace(/^https?:\/\//, "");

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
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 6, color: "#fa586a" }}>
          DEVELOPER SQUAD
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            Battle · Prove · Explain
          </div>
          <div style={{ fontSize: 36, color: "rgba(255,255,255,0.72)" }}>
            Challenge someone with the problem you just solved.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.42)" }}>
            {primerNames.length > 0
              ? `primers · ${primerNames.join(" · ")}`
              : "primers · Sliding Window · Two Pointers · Stack · Graphs · 1D DP"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{host}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}