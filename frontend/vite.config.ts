import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 3004,
    host: true,
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
});
