// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser) => {
    if (!authUser) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single();
        
      if (error) {
        return { ...authUser, role: 'Worker' }; 
      }
      return { ...authUser, ...data };
    } catch (error) {
      return { ...authUser, role: 'Worker' };
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const fullUser = await fetchUserProfile(data.session.user);
        setUser(fullUser);
      }
      setLoading(false);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const fullUser = await fetchUserProfile(session.user);
        setUser(fullUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      
      const fullUser = await fetchUserProfile(data.user);
      setUser(fullUser);
      
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // 🔥 AQUÍ ESTÁ LA CORRECCIÓN: Un cierre de sesión a prueba de fallos
  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Error interno al cerrar sesión, forzando salida:", error);
    } finally {
      setUser(null); // Borramos al usuario sí o sí
      setLoading(false); // Apagamos la rueda de carga sí o sí
    }
  };

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
