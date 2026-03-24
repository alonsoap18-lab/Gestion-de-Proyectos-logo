import axios from 'axios';

// Base URL dinámico: usa env si está definido, sino localhost en dev
const baseURL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 20000,
});

// Agregar token de Supabase o de login
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('icaa_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Manejo de errores global
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('icaa_token');
      localStorage.removeItem('icaa_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
