import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: parseInt(process.env.FRONTEND_PORT || '3004'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || '8004'}`,
        changeOrigin: true,
      },
    },
  },
});
