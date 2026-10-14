import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";

export const alt = "A squad invite on Mahayuddh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Invite OG card.
 *
 * When an invite link is pasted into WhatsApp / Discord / Twitter, THIS is the
 * product — a stranger's whole first impression. So it carries the squad's
 * real name, real size, and who sent it, in the same visual language as the
 * app. A generic brand card would waste the only free-marketing surface that
 * targets exactly the right people (the inviter's own groups).
 *
 * Deliberately does NOT count an open: link scrapers fetch this on every
 * paste, and an open is a human act. Counting scrapes would tell members
 * their pitch is being read when it is only being unfurled.
 */
export default async function InviteOpengraphImage({
  params,
}: {
  params: { code: string };
}) {
  const code = (params.code || "").trim().toUpperCase();

  let name: string | null = null;
  let memberCount = 0;
  let initials: string[] = [];
  if (/^[A-Z0-9]{8}$/.test(code)) {
    const supabase = getServiceClient();
    if (supabase) {
      const { data: squad } = await supabase
        .from("squads")
        .select("id, name")
        .eq("invite_code", code)
        .maybeSingle();
      if (squad) {
        name = (squad as { name: string }).name;
        const { count } = await supabase
          .from("squad_members")
          .select("squad_id", { count: "exact", head: true })
          .eq("squad_id", (squad as { id: string }).id);
        memberCount = count ?? 0;
        const { data: sample } = await supabase
          .from("squad_members")
          .select("profile:user_id (username)")
          .eq("squad_id", (squad as { id: string }).id)
          .order("joined_at", { ascending: true })
          .limit(5);
        initials = ((sample ?? []) as { profile: { username: string } | { username: string }[] }[])
          .map((r) => {
            const prof = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            return ((prof as { username: string } | undefined)?.username || "?")
              .charAt(0)
              .toUpperCase();
          })
          .slice(0, 5);
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 55%, #1a150d 100%)",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#F5B83D" }}>
            SQUAD INVITE
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              fontSize: 26,
              fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span>Mahayuddh</span>
            <span style={{ color: "#F5B83D" }}>.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.05,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 1072,
            }}
          >
            {name ?? "Join a squad"}
          </div>
          <div style={{ fontSize: 34, color: "rgba(255,255,255,0.66)", lineHeight: 1.3 }}>
            {name
              ? `${memberCount} ${memberCount === 1 ? "member battles" : "members battle"} the same problems and compare approaches.`
              : "Battle the same problems your people battle. Compare approaches."}
          </div>
          {initials.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {initials.map((ch, i) => (
                <div
                  key={i}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#ffffff",
                    background: "rgba(245,184,61,0.18)",
                    border: "2px solid rgba(245,184,61,0.45)",
                  }}
                >
                  {ch}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
          mahayuddh.app
        </div>
      </div>
    ),
    { ...size }
  );
}
