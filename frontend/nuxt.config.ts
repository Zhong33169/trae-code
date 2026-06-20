// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  ssr: false,
  modules: ['@pinia/nuxt', '@pinia-plugin-persistedstate/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:8002',
      frontendPort: process.env.PORT || 3002
    }
  },
  devServer: {
    port: parseInt(process.env.PORT || '3002'),
    host: '0.0.0.0'
  },
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.API_BASE_URL || 'http://localhost:8002',
        changeOrigin: true
      }
    }
  },
  app: {
    head: {
      title: '新闻采编中心 - 线索管理系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  }
})
