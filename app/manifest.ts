import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mahayuddh - Developer Squad DSA Arena",
    short_name: "Mahayuddh",
    description: "Practice DSA with your people. Battle, prove, explain, challenge.",
    // Home is the canonical route since the IA change (plan Step 4).
    id: "/home",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#0A0B0E",
    theme_color: "#0A0B0E",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
