import { defineConfig, loadEnv } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT) || 31010
  const apiUrl = env.VITE_API_URL || 'http://localhost:51010'

  return {
    plugins: [solidPlugin()],
    server: {
      port: port,
      host: true,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true
        },
        '/health': {
          target: apiUrl,
          changeOrigin: true
        }
      }
    },
    build: {
      target: 'esnext'
    }
  }
})
