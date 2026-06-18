import { defineConfig } from "@tanstack/start/config";
import { loadEnv } from "vite";

// 统一从 frontend/.env 读取端口与后端地址：
// - FRONTEND_PORT 驱动前端端口（默认 3001）
// - BACKEND_PORT / VITE_API_URL 驱动前端访问的后端 API 地址（默认 8001）
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

const frontendPort = parseInt(env.FRONTEND_PORT || process.env.FRONTEND_PORT || "3001");
const backendPort = env.BACKEND_PORT || process.env.BACKEND_PORT || "8001";
const apiUrl =
  env.VITE_API_URL || process.env.VITE_API_URL || `http://localhost:${backendPort}/api`;

export default defineConfig({
  server: {
    preset: "node-server",
    port: frontendPort,
  },
  vite: {
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
      "import.meta.env.VITE_BACKEND_PORT": JSON.stringify(backendPort),
      "import.meta.env.VITE_FRONTEND_PORT": JSON.stringify(String(frontendPort)),
    },
  },
});
