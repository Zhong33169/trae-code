import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/care-records' },
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  { path: '/care-records', name: 'CareRecordList', component: () => import('../views/CareRecordList.vue') },
  { path: '/care-records/:id', name: 'CareRecordDetail', component: () => import('../views/CareRecordDetail.vue') },
  { path: '/care-records/new', name: 'CareRecordNew', component: () => import('../views/CareRecordNew.vue') },
  { path: '/audit', name: 'AuditLog', component: () => import('../views/AuditLog.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
