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
      // Le damos máximo 8 segundos para traer el perfil
      const response = await Promise.race([
        supabase.from('users').select('*').eq('email', authUser.email).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
      ]);
      
      if (response.error) return { ...authUser, role: 'Worker' }; 
      return { ...authUser, ...response.data };
    } catch (error) {
      return { ...authUser, role: 'Worker' };
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const fullUser = await fetchUserProfile(data.session.user);
          setUser(fullUser);
        }
      } catch (e) {
        console.warn("No se pudo recuperar la sesión:", e);
      } finally {
        setLoading(false);
      }
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
      // 🔥 EL TEMPORIZADOR: Máximo 10 segundos de espera. Evita que se quede "pegado" infinito.
      const response = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de conexión agotado. Revisa tu internet o antivirus.")), 10000))
      ]);

      if (response.error) return { ok: false, error: response.error.message };
      
      const fullUser = await fetchUserProfile(response.data.user);
      setUser(fullUser);
      
      return { ok: true };
    } catch (err) {
      // Ahora sí regresará el error rápido y quitará el "Cargando..."
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch (error) {
      console.warn("Error interno al cerrar sesión, forzando salida:", error);
    } finally {
      setUser(null); 
      setLoading(false); 
      
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
