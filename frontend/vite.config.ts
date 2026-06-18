import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(() => {
  return {
    plugins: [react()],
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
      host: true,
    },
    resolve: {
      alias: {
        '~': resolve(__dirname, './src'),
      },
    },
  };
});
