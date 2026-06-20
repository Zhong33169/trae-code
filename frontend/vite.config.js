import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3005,
    proxy: {
      '/api': {
        target: 'http://localhost:8005',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
