// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // asegúrate de tener tu instancia supabase

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // para indicar carga de sesión
  const [error, setError] = useState(null);

  // Cargar sesión al iniciar
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        // Obtener rol desde tu tabla 'users'
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.session.user.id)
          .single();

        setUser({ ...data.session.user, role: profile?.role ?? null });
      }
      setLoading(false);
    };

    getSession();

    // Escuchar cambios de sesión (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();
          setUser({ ...session.user, role: profile?.role ?? null });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // Login
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return { ok: false, error: error.message };
      }

      // Obtener rol del usuario
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      setUser({ ...data.user, role: profile?.role ?? null });
      return { ok: true };
    } catch (err) {
      setError(err.message || 'Error de conexión');
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout
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
