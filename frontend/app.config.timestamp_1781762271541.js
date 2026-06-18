// app.config.ts
import { defineConfig } from "@tanstack/start/config";
var app_config_default = defineConfig({
  server: {
    preset: "node-server",
    port: 3004
  },
  vite: {
    server: {
      port: 3004
    }
  }
});
export {
  app_config_default as default
};
