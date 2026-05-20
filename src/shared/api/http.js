import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://apis.care.org.vn'

const wrap = async (promise) => {
  try {
    const res = await promise
    return { status: res.status, payload: res.data }
  } catch (err) {
    return { status: err.response?.status || 500, payload: err.response?.data }
  }
}

const instance = axios.create({ baseURL: BASE_URL })

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

instance.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const httpAuth = {
  get:    (url) => wrap(instance.get(url)),
  post:   (url, data) => wrap(instance.post(url, data)),
  patch:  (url, data) => wrap(instance.patch(url, data)),
  delete: (url) => wrap(instance.delete(url)),
}
export const http = httpAuth
