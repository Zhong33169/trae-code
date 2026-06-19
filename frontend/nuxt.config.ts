export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8003/api',
    },
  },
  devServer: {
    port: 3003,
  },
  ui: {
    primary: 'blue',
    gray: 'slate',
  },
  css: ['~/assets/css/main.css'],
});
