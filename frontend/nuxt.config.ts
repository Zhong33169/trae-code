// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  devServer: {
    port: 3001,
    host: '0.0.0.0'
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8001/api'
    }
  },

  modules: [
    '@pinia/nuxt'
  ],

  css: [
    '~/assets/css/main.css'
  ],

  typescript: {
    strict: true,
    typeCheck: false
  },

  app: {
    head: {
      title: '贷款展期业务工作台',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '贷款展期业务管理系统工作台' }
      ]
    }
  }
})
