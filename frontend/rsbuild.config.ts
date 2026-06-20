import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: Number(process.env.PORT) || 3004,
  },
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  html: {
    title: '媒体邀约单管理系统',
    template: './public/index.html',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    distPath: {
      root: './dist',
    },
  },
});
