// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  devServer: {
    port: 3107,
    host: '0.0.0.0'
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8107/api'
    }
  },
  app: {
    head: {
      title: '社区健身房-会员入会单系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },
  css: [
    '~/assets/css/main.css'
  ]
})
