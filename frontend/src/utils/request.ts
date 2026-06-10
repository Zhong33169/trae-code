import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiResponse } from '../types'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const data = response.data
    if (data.code === 200 || !data.code) {
      return response
    }
    return Promise.reject(new Error(data.message || '请求失败'))
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    const message = error.response?.data?.message || error.message || '网络请求失败'
    return Promise.reject(new Error(message))
  }
)

export async function get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
  const res = await request.get(url, { params, ...config })
  return res.data?.data ?? res.data
}

export async function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const res = await request.post(url, data, config)
  return res.data?.data ?? res.data
}

export async function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const res = await request.put(url, data, config)
  return res.data?.data ?? res.data
}

export async function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await request.delete(url, config)
  return res.data?.data ?? res.data
}

export default request
