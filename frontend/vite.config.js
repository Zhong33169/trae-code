import { defineConfig, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = parseInt(env.VITE_PORT || '3007', 10);
  const apiBase = env.VITE_API_BASE || 'http://localhost:8007';

  return {
    plugins: [solidPlugin()],
    server: {
      port: port,
      host: '0.0.0.0',
    },
    build: {
      target: 'esnext',
    },
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase),
      'import.meta.env.VITE_PORT': JSON.stringify(port),
    },
  };
});
