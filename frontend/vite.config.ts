import { defineConfig } from "vite";
import { createStartVitePlugin } from "@tanstack/start/vite";
import path from "path";

export default defineConfig({
  plugins: [createStartVitePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./app"),
    },
  },
  server: {
    port: 3006,
    proxy: {
      "/api": {
        target: "http://localhost:8006",
        changeOrigin: true,
      },
    },
  },
});
