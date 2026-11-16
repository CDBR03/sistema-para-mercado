import axios from 'axios'

export const TOKEN_KEY = 'mercado.token'

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL })

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLogin = error.config?.url?.includes('/api/auth/login')
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('mercado.user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default http
