// src/context/AuthContext.jsx
import { createContext, useContext, useState } from 'react';
import { supabase } from '../lib/supabase'; // <-- ¡Ruta corregida apuntando a lib!

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
      // 1. Buscamos en tu tabla 'users' de Supabase el correo y la contraseña
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      // 2. Si hay error o no encuentra el usuario, rechazamos el login
      if (error || !data) {
        return { ok: false, error: 'Correo o contraseña incorrectos.' };
      }

      // 3. Si todo está bien, guardamos los datos del usuario para mantener la sesión
      localStorage.setItem('icaa_user', JSON.stringify(data));
      setUser(data);
      
      // Limpiamos cualquier rastro del sistema viejo
      localStorage.removeItem('icaa_token'); 
      
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'Error de conexión con la base de datos.' };
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
