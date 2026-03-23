// src/context/AuthContext.jsx
import { createContext, useContext, useState } from 'react';
import api from '../lib/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('icaa_user')); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  async function login(email, password) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('icaa_token', data.token);
      localStorage.setItem('icaa_user',  JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || 'Error de conexión.' };
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('icaa_token');
    localStorage.removeItem('icaa_user');
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, login, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
