import { defineConfig, loadEnv } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.FRONTEND_PORT || process.env.FRONTEND_PORT) || 4200;
  const backendPort = Number(env.BACKEND_PORT || process.env.BACKEND_PORT) || 8080;

  return {
    plugins: [angular()],
    server: {
      port: port,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
    },
    resolve: {
      mainFields: ['module', 'main'],
    },
  };
});
