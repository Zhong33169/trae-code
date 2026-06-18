import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const FRONTEND_PORT = parseInt(process.env.VITE_PORT || process.env.PORT || '3004', 10);
const API_BASE = process.env.VITE_API_BASE || 'http://localhost:8004';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: FRONTEND_PORT,
    host: true,
    proxy: {
      '/api': {
        target: API_BASE,
        changeOrigin: true
      }
    }
  },
  preview: {
    port: FRONTEND_PORT,
    host: true
  }
});
