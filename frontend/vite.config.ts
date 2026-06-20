import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import path from 'node:path';

export default defineConfig({
  plugins: [
    angular({
      tsconfig: path.resolve(__dirname, 'tsconfig.app.json')
    })
  ],
  server: {
    port: 3004,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8004',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3004
  },
  build: {
    target: 'es2022'
  }
});
