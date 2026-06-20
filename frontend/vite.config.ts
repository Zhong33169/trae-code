import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  }
})
