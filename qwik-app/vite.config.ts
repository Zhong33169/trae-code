import { defineConfig, type UserConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';

export default defineConfig((): UserConfig => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: 3002,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8002',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3002,
      headers: {
        'Cache-Control': 'public, max-age=600',
      },
    },
  };
});
