import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://apis.care.org.vn'

export const http = axios.create({ baseURL: BASE_URL })
export const httpAuth = axios.create({ baseURL: BASE_URL })

httpAuth.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

httpAuth.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
