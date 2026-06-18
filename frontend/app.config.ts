import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    port: 3003,
  },
  vite: {
    server: {
      port: 3003,
      proxy: {
        "/api": {
          target: "http://localhost:8003",
          changeOrigin: true,
        },
      },
    },
  },
});
