import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const backendPort = process.env.BACKEND_PORT || 8002;
const frontendPort = process.env.FRONTEND_PORT || 3002;

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.jsx',
    },
  },
  server: {
    port: parseInt(frontendPort),
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  html: {
    title: 'K12培训课程服务单系统',
  },
});
