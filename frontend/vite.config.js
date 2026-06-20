import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3004,
    proxy: {
      '/api': {
        target: 'http://localhost:8004',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8004',
        changeOrigin: true
      }
    }
  }
})
