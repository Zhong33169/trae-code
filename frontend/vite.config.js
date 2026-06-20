import { defineConfig } from 'vite';
import { resolve } from 'path';

const backendPort = process.env.BACKEND_PORT || 8005;
const frontendPort = process.env.FRONTEND_PORT || 3005;

export default defineConfig({
  server: {
    port: parseInt(frontendPort),
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
