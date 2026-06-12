import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

import ClueQueue from './views/ClueQueue.vue';
import ClueDetail from './views/ClueDetail.vue';
import EnterpriseLeads from './views/EnterpriseLeads.vue';

const routes = [
  { path: '/', redirect: '/queue' },
  { path: '/queue', component: ClueQueue, name: 'ClueQueue' },
  { path: '/queue/:orderNo', component: ClueDetail, name: 'ClueDetail', props: true },
  { path: '/enterprises', component: EnterpriseLeads, name: 'EnterpriseLeads' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
