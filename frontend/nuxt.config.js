export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [],
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:8001/api'
    }
  },
  devServer: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    host: '0.0.0.0'
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: '生产工单扫码核验系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  }
})
