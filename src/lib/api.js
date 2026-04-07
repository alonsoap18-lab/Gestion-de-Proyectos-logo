// frontend/src/lib/api.js
// Works on Vercel (relative /api routes) and local `vercel dev`
import axios from 'axios';

const api = axios.create({
  // SOLUCIÓN: Apuntamos a la ruta de la API, no a la pantalla de login
  baseURL: '/api', 
  timeout: 20000,
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('icaa_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('icaa_token');
      localStorage.removeItem('icaa_user');
      // Redirigir al login solo si la sesión realmente expiró
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
