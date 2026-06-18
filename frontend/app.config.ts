import { defineConfig } from "@tanstack/start/config";

export default defineConfig({
  server: {
    preset: "node-server",
    port: parseInt(process.env.FRONTEND_PORT || "3001"),
  },
  vite: {
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(
        process.env.VITE_API_URL || "http://localhost:8001/api"
      ),
    },
  },
});
