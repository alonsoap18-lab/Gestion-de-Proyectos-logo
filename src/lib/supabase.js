import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gdjvdjssfuzdurstcyoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkanZkanNzZnV6ZHVyc3RjeW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTcxMjAsImV4cCI6MjA4OTg3MzEyMH0.lcPT-xx4mtyMM6lvpaTLNIienUMtk578vfsgsO38UVI';

export const supabase = createClient(supabaseUrl, supabaseKey);
