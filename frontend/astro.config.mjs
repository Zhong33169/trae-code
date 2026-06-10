import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const backendPort = process.env.BACKEND_PORT || '8000';
const frontendPort = parseInt(process.env.FRONTEND_PORT || '4321');

export default defineConfig({
  integrations: [react()],
  server: {
    port: frontendPort,
    host: true,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
    },
  },
  vite: {
    define: {
      'import.meta.env.BACKEND_PORT': JSON.stringify(backendPort),
    },
  },
});
