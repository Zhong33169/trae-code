// app.config.ts
import { defineConfig } from "@tanstack/start/config";
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
