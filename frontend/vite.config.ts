import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const DEFAULT_BACKEND_PORT = env.BACKEND_PORT || '8004';
  const DEFAULT_FRONTEND_PORT = env.FRONTEND_PORT || '3004';

  return {
    server: {
      port: Number(DEFAULT_FRONTEND_PORT),
      host: true,
      proxy: {
        "/api": {
          target: `http://localhost:${DEFAULT_BACKEND_PORT}`,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "app"),
      },
    },
    define: {
      'process.env.BACKEND_PORT': JSON.stringify(DEFAULT_BACKEND_PORT),
      'process.env.FRONTEND_PORT': JSON.stringify(DEFAULT_FRONTEND_PORT),
    },
  };
});
