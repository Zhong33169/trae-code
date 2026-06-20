import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    port: 3002,
    preset: "node-server"
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8002",
          changeOrigin: true
        }
      }
    }
  }
});
