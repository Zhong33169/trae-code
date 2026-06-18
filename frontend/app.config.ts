import { defineConfig } from '@solidjs/start/config';

export default defineConfig({
  server: {
    baseURL: 'http://localhost:3004',
  },
  vite: {
    server: { port: 3004 },
  },
  ssr: false,
});
