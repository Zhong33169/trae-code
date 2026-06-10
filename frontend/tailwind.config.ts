import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf1',
          100: '#c5cdd9',
          200: '#9eacc0',
          300: '#778ba7',
          400: '#597294',
          500: '#3b5981',
          600: '#2f4a6e',
          700: '#1e3a5f',
          800: '#162d4b',
          900: '#0e1f35',
        },
        gold: {
          50: '#faf5e9',
          100: '#f3e6c4',
          200: '#ebd69d',
          300: '#e3c676',
          400: '#d4a853',
          500: '#c4933a',
          600: '#ab7d2e',
          700: '#8f6525',
          800: '#744f1e',
          900: '#593b17',
        },
      },
    },
  },
  plugins: [],
};
export default config;
