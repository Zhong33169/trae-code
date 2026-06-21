import { defineConfig } from '@solidjs/start/config';

const PORT = parseInt(process.env.PORT || '3004', 10);
const API_URL = process.env.API_URL || 'http://localhost:8004';
const CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3004';

export default defineConfig({
  ssr: false,
  server: {
    preset: process.env.NODE_ENV === 'production' ? 'node' : 'development',
    port: PORT,
    compressPublicAssets: true,
    routeRules: {
      '/api/**': { proxy: `${API_URL}/**` },
    },
    experimental: {
      corsOrigins: CORS_ORIGINS.split(','),
    },
  },
  vite: {
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.API_URL || API_URL),
      'process.env.API_URL': JSON.stringify(process.env.API_URL || API_URL),
    },
    server: {
      port: PORT,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
  },
});
