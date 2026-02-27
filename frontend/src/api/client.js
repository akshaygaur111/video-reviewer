import axios from 'axios'

const API = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
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
  getAllJobs: () => API.get('/admin/jobs'),
  getUsers:   () => API.get('/admin/users'),
  getStats:   () => API.get('/admin/stats'),
}

export default API
