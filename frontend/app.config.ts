import { defineConfig } from '@tanstack/start/config';

export default defineConfig({
  server: {
    preset: 'node-server',
    port: 3004
  },
  vite: {
    server: {
      port: 3004
    }
  }
});
