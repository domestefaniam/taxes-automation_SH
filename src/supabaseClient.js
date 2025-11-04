import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
} else {
  // Log de diagnóstico (seguro): muestra URL y los primeros 8 caracteres de la key
  // No imprime la key completa
  // Abre la consola del navegador para verlo
  console.log('[Supabase ENV]', {
    url: supabaseUrl,
    anonKeyHead: (supabaseKey || '').slice(0, 8)
  })
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
