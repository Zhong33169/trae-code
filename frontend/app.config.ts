import { defineConfig } from "@tanstack/start/config";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  tsr: {
    generatedRouteTree: "./app/routeTree.gen.ts",
  },
  vite: {
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
  },
});
