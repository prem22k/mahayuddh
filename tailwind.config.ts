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
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        surface: {
          base: "#000000",
          sidebar: "#121212",
          muted: "#1c1c1e",
          raised: "#2c2c2e",
          strong: "#3a3a3c",
          bar: "rgba(22, 22, 24, 0.85)",
        },
        apple: {
          accent: "#fa586a",
          accentDark: "#d60017",
          green: "#30d158",
          orange: "#ff9f0a",
          red: "#ff453a",
          blue: "#0a84ff",
          purple: "#bf5af2",
          yellow: "#ffd60a",
          teal: "#64d2ff",
        },
        txt: {
          primary: "#ffffff",
          secondary: "#8e8e93",
          tertiary: "#636366",
          inverse: "#1d1d1f",
        },
        difficulty: {
          easy: "#30d158",
          medium: "#ff9f0a",
          hard: "#ff453a",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.08)",
          strong: "rgba(255, 255, 255, 0.16)",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "7px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
        pill: "9999px",
      },
      boxShadow: {
        subtle: "0 8px 24px rgba(0, 0, 0, 0.4)",
        modal: "0 24px 64px rgba(0, 0, 0, 0.8)",
        glow: "0 0 20px rgba(250, 88, 106, 0.35)",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
