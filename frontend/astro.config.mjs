import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const backendPort = process.env.BACKEND_PORT || '8080';
const frontendPort = parseInt(process.env.FRONTEND_PORT || '4321');

export default defineConfig({
  integrations: [react()],
  server: {
    port: frontendPort,
    host: true,
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  },
});
