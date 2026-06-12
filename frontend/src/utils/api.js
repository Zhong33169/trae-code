import { useAuth } from '../context/AuthContext.jsx'

const BASE_URL = '/api'

export function useApi() {
  const { getToken, setLoading } = useAuth()

  const request = async (path, options = {}) => {
    setLoading(true)
    try {
      const response = await fetch(BASE_URL + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getToken(),
          ...(options.headers || {}),
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `请求失败: ${response.status}`)
      }

      return data
    } finally {
      setLoading(false)
    }
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
    del: (path) => request(path, { method: 'DELETE' }),
  }
}
