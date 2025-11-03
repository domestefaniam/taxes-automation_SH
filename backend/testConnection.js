// backend/testConnection.js
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

console.log('🧩 Probando conexión con Supabase...')
console.log('🔗 URL:', url || '❌ No encontrada')
console.log('🔐 KEY (primeros 10):', key ? key.substring(0, 10) + '...' : '❌ No encontrada')

if (!url || !key) {
  console.error('⚠️ ERROR: Las variables de entorno no están definidas. Verifica tu archivo .env.')
  process.exit(1)
}

const supabase = createClient(url, key)

try {
  const { data, error } = await supabase.from('counties').select('*').limit(3)

  if (error) {
    console.error('❌ Error al conectar con Supabase:', error.message)
  } else if (data && data.length > 0) {
    console.log('✅ Conexión exitosa. Datos obtenidos:')
    console.table(data)
  } else {
    console.warn('⚠️ Conexión exitosa, pero la tabla "counties" está vacía o no existe.')
  }
} catch (err) {
  console.error('💥 Error inesperado:', err.message)
}




