import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 30010,
    proxy: {
      '/api': {
        target: 'http://localhost:18010',
        changeOrigin: true,
      },
    },
  },
});
