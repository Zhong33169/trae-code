import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1A2B2B",
          soft: "#3D5050",
          muted: "#6B7D7D",
        },
        paper: "#F5F7F6",
        deep: {
          DEFAULT: "#0E4D4D",
          50: "#E6F2F2",
          100: "#C8E5E5",
          200: "#8FCCCC",
          300: "#56B3B3",
          400: "#2E8585",
          500: "#0E4D4D",
          600: "#0B3E3E",
          700: "#082F2F",
          800: "#052020",
          900: "#021010",
        },
        aqua: {
          DEFAULT: "#0EA5B7",
          light: "#5FD3E0",
        },
        amber: {
          warn: "#D97706",
          soft: "#FEF3C7",
        },
        crimson: {
          DEFAULT: "#DC2626",
          soft: "#FEE2E2",
        },
        emerald: {
          ok: "#059669",
          soft: "#D1FAE5",
        },
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', "sans-serif"],
        body: ['"Manrope"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        DEFAULT: "4px",
      },
      backgroundImage: {
        "blueprint": "linear-gradient(rgba(14,77,77,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(14,77,77,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-sm": "24px 24px",
      },
      animation: {
        "pulse-crimson": "pulse-crimson 2s ease-in-out infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
      keyframes: {
        "pulse-crimson": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
