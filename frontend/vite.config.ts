import { defineConfig, loadEnv } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = parseInt(env.FRONTEND_PORT || "3002", 10);

  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: port,
      strictPort: true,
    },
    preview: {
      port: port,
      strictPort: true,
    },
    build: {
      target: "es2020",
    },
  };
});
