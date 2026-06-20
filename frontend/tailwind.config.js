/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
      colors: {
        navy: '#1e3a5f',
        amber: '#d97706',
      },
    },
  },
  plugins: [],
};
