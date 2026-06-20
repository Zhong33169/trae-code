// app.config.ts
import { defineConfig } from "@tanstack/start/config";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
var app_config_default = defineConfig({
  server: {
    preset: "node-server"
  },
  vite: {
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "./app")
      }
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss()
    ],
    server: {
      port: 3003,
      proxy: {
        "/api": {
          target: "http://localhost:8003",
          changeOrigin: true
        }
      }
    }
  }
});
export {
  app_config_default as default
};
