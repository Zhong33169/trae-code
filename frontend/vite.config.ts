import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: parseInt(process.env.PORT || '3004'),
    host: true,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:8004',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
});
