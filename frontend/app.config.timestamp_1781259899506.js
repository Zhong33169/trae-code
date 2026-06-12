// app.config.ts
import { defineConfig } from "@tanstack/start/config";
import tailwindcss from "tailwindcss";
var app_config_default = defineConfig({
  vite: {
    css: {
      postcss: {
        plugins: [tailwindcss()]
      }
    },
    server: {
      port: 3006
    }
  }
});
export {
  app_config_default as default
};
