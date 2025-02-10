import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Inicializando cliente Supabase...');
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Verificar la conexión y los permisos
const checkConnection = async () => {
  try {
    console.log('Verificando conexión a Supabase...');
    
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('Error en autenticación:', authError);
    } else {
      console.log('Estado de autenticación:', authData ? 'Autenticado' : 'No autenticado');
    }

    // Intentar una consulta simple para verificar permisos
    const { data, error } = await supabase
      .from('conversation')
      .select('count')
      .limit(1)
      .single();

    if (error) {
      console.error('Error al verificar permisos:', error);
    } else {
      console.log('Permisos verificados correctamente');
    }
  } catch (error) {
    console.error('Error al verificar conexión:', error);
  }
};

checkConnection();