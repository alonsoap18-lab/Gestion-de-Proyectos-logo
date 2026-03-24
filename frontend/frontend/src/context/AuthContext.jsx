// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // tu instancia de supabase

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // para saber si la sesión se está cargando

  // Al cargar la app, obtenemos la sesión actual de Supabase
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    getSession();

    // Escuchar cambios de sesión (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Función de login
  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { ok: false, error: error.message };

      setUser(data.user);
      return { ok: true };
    } finally {
      setLoading(false);
    }
  };

  // Función de logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
