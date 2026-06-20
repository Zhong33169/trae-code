import axios from 'axios'
import { useUserStore } from '../stores/user'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.request.use(config => {
  const userStore = useUserStore()
  if (userStore.user) {
    config.headers['x-user-id'] = userStore.user.id
    config.headers['x-user-role'] = userStore.user.role
    config.headers['x-user-name'] = userStore.user.name
  }
  return config
})

export default api
