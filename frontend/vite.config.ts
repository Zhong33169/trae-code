import { defineConfig, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = parseInt(env.PORT || '3003');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:8003';

  return {
    plugins: [solidPlugin()],
    server: {
      port,
      host: true,
    },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
  };
});
