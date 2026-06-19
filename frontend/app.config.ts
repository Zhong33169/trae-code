import { defineConfig } from '@tanstack/start/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    preset: 'node-server',
  },
  vite: {
    plugins: [tsconfigPaths() as any],
    server: {
      port: 3001,
    },
  },
} as any)
