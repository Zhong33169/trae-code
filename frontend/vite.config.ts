import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tanstackStart({
      srcDirectory: 'app',
    }),
    nitro(),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
    },
  },
  nitro: {
    preset: 'node-server',
    ssr: false,
  },
})
