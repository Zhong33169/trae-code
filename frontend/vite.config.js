import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const backendPort = process.env.BACKEND_PORT || '8002';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: parseInt(process.env.FRONTEND_PORT || '3002'),
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true
      }
    }
  }
});
