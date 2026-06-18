import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue'
import Materials from '../views/Materials.vue'
import MaterialDetail from '../views/MaterialDetail.vue'
import NewMaterial from '../views/NewMaterial.vue'
import Audit from '../views/Audit.vue'
import BatchTasks from '../views/BatchTasks.vue'
import Dashboard from '../views/Dashboard.vue'

const routes = [
  { path: '/login', component: Login },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: Dashboard, meta: { title: '工作台' } },
      { path: 'materials', component: Materials, meta: { title: '诉讼材料单' } },
      { path: 'materials/new', component: NewMaterial, meta: { title: '新建诉讼材料登记' } },
      { path: 'materials/:id', component: MaterialDetail, meta: { title: '材料单详情' } },
      { path: 'audit', component: Audit, meta: { title: '审计日志' } },
      { path: 'batches', component: BatchTasks, meta: { title: '批量任务记录' } },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
