import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    port: 3008,
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8008",
          changeOrigin: true,
        },
      },
    },
  },
});
