import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    port: 3002,
    preset: "node-server"
  },
  vite: {
    resolve: {
      alias: {
        "~": "/src",
        "#start/app": "/src/root.tsx"
      }
    },
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
