import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

const API_URL = process.env.VITE_API_URL || 'http://localhost:8007';
const PORT = Number(process.env.VITE_PORT) || 3007;

export default defineConfig({
  plugins: [preact()],
  server: {
    port: PORT,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: PORT,
    host: '0.0.0.0',
  },
});
