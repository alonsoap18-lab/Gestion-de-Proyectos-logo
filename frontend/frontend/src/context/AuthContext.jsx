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

  // 🔥 NUEVO CIERRE DE SESIÓN: Rápido, forzado y limpia toda la basura del navegador
  const logout = async () => {
    setLoading(true);
    try {
      // Le damos máximo 2 segundos a Supabase para responder
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch (error) {
      console.warn("Error interno al cerrar sesión, forzando salida:", error);
    } finally {
      setUser(null); 
      setLoading(false); 
      
      // Limpiamos la caché del navegador a la fuerza para evitar el token corrupto
      localStorage.clear();
      sessionStorage.clear();
      
      // Recargamos la página mandando al usuario al login limpio
      window.location.href = '/login';
    }
  };

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
