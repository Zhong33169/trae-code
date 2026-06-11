import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3007,
    proxy: {
      '/api': {
        target: 'http://localhost:8007',
        changeOrigin: true,
      },
    },
  },
});
