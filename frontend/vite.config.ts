import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 3004,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:8004',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3004,
    host: true
  }
});
