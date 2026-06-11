import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3002,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
  },
});
