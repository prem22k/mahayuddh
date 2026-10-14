import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
        sans: ["var(--font-sans)", "Geist", "sans-serif"],
        mono: ["var(--font-mono-face)", "JetBrains Mono", "monospace"],
      },
      colors: {
        canvas: "#0A0B0E",
        well: "#0E0F12",
        surface: {
          DEFAULT: "#141518",
          raised: "#191A1E",
          overlay: "#202127",
        },
        hairline: "rgba(255, 255, 255, 0.08)",
        "hairline-strong": "rgba(255, 255, 255, 0.14)",
        "edge-highlight": "rgba(255, 255, 255, 0.04)",
        text: {
          primary: "#EDEDEF",
          secondary: "#A1A3AB",
          tertiary: "#84868F",
          disabled: "#55575E",
        },
        "on-primary": "#1A1406",
        primary: {
          DEFAULT: "#F5B83D",
          hover: "#FFC95E",
          pressed: "#E0A32B",
          tint: "#2A251C",
        },
        secondary: "#A1A3AB",
        tertiary: "#8B91F7",
        neutral: "#141518",
        verified: {
          DEFAULT: "#3DDC97",
          tint: "#182925",
        },
        pattern: {
          DEFAULT: "#8B91F7",
          tint: "#222433",
        },
        error: {
          DEFAULT: "#F26D78",
          tint: "#2A1E22",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      boxShadow: {
        lifted: "0 8px 24px -8px rgba(0,0,0,0.5)",
        overlay: "0 24px 64px -16px rgba(0,0,0,0.7)",
      },
      maxWidth: {
        content: "1120px",
        reading: "680px",
      },
      keyframes: {
        stamp: {
          "0%": { opacity: "0", transform: "scale(1.12)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "bloom-fade": {
          "0%": { opacity: "0.2" },
          "100%": { opacity: "0" },
        },
        "gold-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        skeleton: {
          "0%": { opacity: "0.5" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        stamp: "stamp 280ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "bloom-fade": "bloom-fade 600ms ease-out both",
        "gold-pulse": "gold-pulse 2s ease-in-out infinite",
        skeleton: "skeleton 1.6s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};

export default config;
