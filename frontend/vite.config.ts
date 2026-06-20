import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: 3005,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:8005',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3005,
      host: '0.0.0.0',
    },
  };
});
