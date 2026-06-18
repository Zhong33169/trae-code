import { defineConfig } from 'vite';
import solidPlugin from '@solidjs/start/vite';

export default defineConfig({
  plugins: [solidPlugin()],
  server: { port: 3004 },
});
