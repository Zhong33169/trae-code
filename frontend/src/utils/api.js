import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8010/api',
  timeout: 10000
});

api.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('zs_user') || 'null');
  if (user) {
    config.headers['X-User-Id'] = user.id;
    config.headers['X-User-Role'] = user.role;
  }
  return config;
});

api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response) {
      return error.response.data;
    }
    return { success: false, error: 'NETWORK_ERROR', message: '网络连接失败，请检查后端服务是否启动' };
  }
);

export default api;
