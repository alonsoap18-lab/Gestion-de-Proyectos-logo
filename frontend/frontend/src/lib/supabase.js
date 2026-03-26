import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔍 DIAGNÓSTICO: Esto aparecerá en la consola de tu navegador (F12)
console.log("--- CHEQUEO DE CONEXIÓN ---");
console.log("URL detectada:", supabaseUrl); 
console.log("¿La llave tiene contenido?:", supabaseKey ? "SÍ" : "NO (ESTÁ VACÍA)");
console.log("---------------------------");

export const supabase = createClient(supabaseUrl, supabaseKey);
