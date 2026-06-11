import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          high: "#dc2626",
          medium: "#d97706",
          low: "#16a34a",
        },
        status: {
          pending: "#ca8a04",
          abnormal: "#dc2626",
          done: "#16a34a",
        },
      },
    },
  },
  plugins: [],
};
export default config;
