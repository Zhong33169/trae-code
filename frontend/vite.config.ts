import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: parseInt(process.env.VITE_PORT || '3008'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || '8008'}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
});
