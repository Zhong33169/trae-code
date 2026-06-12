import { defineConfig } from "@tanstack/start/config";
import tailwindcss from "tailwindcss";

export default defineConfig({
  vite: {
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
    server: {
      port: 3006,
    },
  },
});
