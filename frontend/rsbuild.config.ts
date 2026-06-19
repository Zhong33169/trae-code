import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const backendPort = process.env.BACKEND_PORT || '8003';
const frontendPort = parseInt(process.env.FRONTEND_PORT || '3003');

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        pathRewrite: { '^/api': '' },
      },
    },
  },
  html: {
    template: './index.html',
  },
});
