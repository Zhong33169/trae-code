import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    port: 3004,
  },
  vite: {
    server: {
      port: 3004,
      proxy: {
        "/api": {
          target: "http://localhost:8004",
          changeOrigin: true,
        },
      },
    },
  },
});
