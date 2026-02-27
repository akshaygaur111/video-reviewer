import axios from 'axios'

const API = axios.create({
  // VITE_API_URL = your Render backend URL (set in Vercel env vars)
  // Falls back to /api for local dev (Vite proxy handles it)
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 90000,   // 90s — Render free tier cold start can take 50-60s
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  (r) => r,
  (err) => {
    const isAuthRoute = err.config?.url?.includes('/auth/')
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (d) => API.post('/auth/register', d),
  login:    (d) => API.post('/auth/login', d),
  me:       ()  => API.get('/auth/me'),
}

export const reviewsAPI = {
  create: (d)   => API.post('/reviews/', d),
  list:   ()    => API.get('/reviews/'),
  get:    (id)  => API.get(`/reviews/${id}`),
}

export const adminAPI = {
  getAllJobs:  ()  => API.get('/admin/jobs'),
  getUsers:    ()  => API.get('/admin/users'),
  getStats:    ()  => API.get('/admin/stats'),
  createUser:  (d) => API.post('/admin/users', d),
}

export default API
