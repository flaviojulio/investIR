import axios from "axios"

export const api = axios.create({
  baseURL: "http://localhost:8000/api",
})

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token")
      delete api.defaults.headers.common["Authorization"]
      window.location.reload()
    }
    return Promise.reject(error)
  },
)
