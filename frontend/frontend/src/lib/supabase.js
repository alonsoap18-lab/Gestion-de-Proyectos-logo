import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔥 EL AMORTIGUADOR: Función para reintentar automáticamente si hay bloqueos de red (como el error QUIC)
const customFetch = async (url, options) => {
  let retries = 3; // 3 intentos invisibles para el usuario
  let lastError;

  while (retries > 0) {
    try {
      return await fetch(url, options); // Si funciona, pasa directo
    } catch (error) {
      lastError = error;
      retries -= 1;
      
      if (retries > 0) {
        // Si falla, esperamos 1 segundo. Esto le da tiempo al navegador 
        // para cambiar la ruta interna de conexión y saltarse el bloqueo.
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw lastError; // Si fallan los 3 intentos, entonces sí tira el error
};

// Inicializamos Supabase inyectándole nuestra función protectora
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: customFetch,
  },
});
