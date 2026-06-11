import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3008,
    proxy: {
      '/api': {
        target: 'http://localhost:8008',
        changeOrigin: true,
      },
    },
  },
})
