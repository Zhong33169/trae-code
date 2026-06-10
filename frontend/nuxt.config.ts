// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  
  compatibilityDate: '2024-04-03',
  
  modules: ['@pinia/nuxt'],

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8001/api'
    }
  },

  devServer: {
    port: 3001,
    host: '0.0.0.0'
  },

  css: [
    '~/assets/css/main.css'
  ],

  app: {
    head: {
      title: '养老护理院-跨班组交接确认护理计划单系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  }
})
