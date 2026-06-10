// https://nuxt.com/docs/api/configuration/nuxt-config
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3000', 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  ssr: false,
  devServer: {
    port: FRONTEND_PORT,
  },
  runtimeConfig: {
    public: {
      apiBase: `http://localhost:${BACKEND_PORT}/api`,
    },
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: '社区团购订单管理系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
});
