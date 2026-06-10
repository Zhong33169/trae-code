import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3001,
    host: true,
    proxy: {}
  },
  build: {
    target: 'esnext',
  },
})
