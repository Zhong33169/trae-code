import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const port = parseInt(process.env.PORT || '3003', 10);

export default defineConfig({
  integrations: [react()],
  server: {
    port: port,
    host: true
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_PORT': JSON.stringify(process.env.API_PORT || '8003')
    }
  }
});
