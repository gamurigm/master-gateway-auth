import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

// Por defecto `/api` relativo, que es lo correcto cuando el SPA y el backend
// comparten origen: en desarrollo lo resuelve el proxy de Vite y en el
// contenedor lo proxya nginx.
//
// `VITE_API_URL` permite apuntar a un backend en OTRO origen, que es el caso de
// un sitio estatico (Render): alli `/api` chocaria con la regla de reescritura
// `/* -> /index.html` del SPA y toda llamada devolveria el HTML en vez de JSON.
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

const AUTH_FLOW_PATHS = ['/auth/login', '/auth/select-role', '/auth/refresh-token']

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token)
  })
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    const isAuthFlow = AUTH_FLOW_PATHS.some((p) => originalRequest?.url?.includes(p))
    const isAdminRequest = ['/users', '/roles', '/modules', '/menus', '/permissions']
      .some((p) => originalRequest?.url?.includes(p))

    if (error.response?.status === 401 && !isAuthFlow && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post('/api/auth/refresh-token', { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        processQueue(null, data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return api(originalRequest)
      } catch {
        processQueue(error, null)
        if (!isAdminRequest) {
          localStorage.clear()
          sessionStorage.clear()
          window.location.href = '/login'
        }
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status === 403) {
      const isAuthPath = AUTH_FLOW_PATHS.some((p) => originalRequest?.url?.includes(p))
      if (!isAuthPath && !isAdminRequest) {
        window.location.href = '/unauthorized'
      }
    }

    return Promise.reject(error)
  },
)

export default api
