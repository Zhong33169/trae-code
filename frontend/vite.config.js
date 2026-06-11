import { defineConfig, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = parseInt(env.FRONTEND_PORT || '3003', 10);
  const backendUrl = env.VITE_API_BASE || 'http://localhost:8003';

  return {
    plugins: [solidPlugin()],
    server: {
      port,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'esnext',
    },
  };
});
