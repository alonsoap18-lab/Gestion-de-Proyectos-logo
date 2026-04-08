import { createClient } from '@supabase/supabase-js';

// Vite lee las variables que configuraste en Vercel (o en tu .env local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
