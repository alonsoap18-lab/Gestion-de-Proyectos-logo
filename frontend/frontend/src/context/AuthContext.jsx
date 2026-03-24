// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          await fetchUserRole(data.session.user);
        }
      } catch (err) {
        console.error('Error al cargar sesión:', err);
      } finally {
        setLoading(false); // 🔹 siempre setLoading(false)
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchUserRole(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (u) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', u.id)
        .single();
      setUser({ ...u, role: profile?.role || 'User' }); // 🔹 asigna rol por defecto si profile es null
    } catch (err) {
      console.error('Error al obtener rol:', err);
      setUser({ ...u, role: 'User' });
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      await fetchUserRole(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Error de conexión' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
