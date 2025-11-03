# Configuración de Supabase para Property Tax Management System

## 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Anota la URL del proyecto y la API Key

## 2. Configurar Variables de Entorno

1. Copia el archivo `env.example` a `.env`:
```bash
cp env.example .env
```

2. Edita el archivo `.env` con tus credenciales de Supabase:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

## 3. Configurar la Base de Datos

1. Ve al SQL Editor en tu dashboard de Supabase
2. Copia y ejecuta el contenido del archivo `database/schema.sql`
3. Esto creará todas las tablas necesarias y datos de ejemplo

## 4. Configurar Políticas de Seguridad (RLS)

Ejecuta estos comandos en el SQL Editor para configurar Row Level Security:

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todas las operaciones (para desarrollo)
-- En producción, deberías configurar políticas más restrictivas

CREATE POLICY "Allow all operations on counties" ON counties FOR ALL USING (true);
CREATE POLICY "Allow all operations on properties" ON properties FOR ALL USING (true);
CREATE POLICY "Allow all operations on parcels" ON parcels FOR ALL USING (true);
CREATE POLICY "Allow all operations on taxes_information" ON taxes_information FOR ALL USING (true);
CREATE POLICY "Allow all operations on parcel_taxes" ON parcel_taxes FOR ALL USING (true);
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true);
```

## 5. Instalar Dependencias

```bash
npm install
```

## 6. Ejecutar la Aplicación

```bash
# Frontend
npm run dev

# Backend (en otra terminal)
npm run dev:server
```

## 7. Verificar la Conexión

1. Abre la aplicación en el navegador
2. Si la conexión es exitosa, verás los datos de ejemplo cargados
3. Si hay errores, revisa la consola del navegador y las variables de entorno

## Estructura de la Base de Datos

### Tablas Principales:

- **counties**: Condados disponibles
- **properties**: Propiedades del sistema
- **parcels**: Parcelas de cada propiedad
- **taxes_information**: Información de impuestos y arrendamiento
- **parcel_taxes**: Bills/facturas de impuestos
- **payments**: Pagos realizados

### Relaciones:

- properties → parcels (1:N)
- counties → parcels (1:N)
- parcels → parcel_taxes (1:N)
- parcel_taxes → payments (1:N)
- properties → taxes_information (1:1)

## Funcionalidades Implementadas

✅ **Add New Property**: Crear propiedades con counties, parcels y tax info
✅ **Add New Bill**: Registrar bills en parcel_taxes
✅ **Add New Payment**: Registrar pagos y actualizar status de bills
✅ **Change Property Status**: Cambiar estado Open/Closed
✅ **MasterList**: Exportar lista de propiedades a Excel
✅ **Excel Report**: Reportes filtrados de pagos
✅ **KPIs**: Dashboard con métricas comprehensivas

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Reinicia el servidor de desarrollo

### Error: "Failed to fetch"
- Verifica que la URL de Supabase es correcta
- Verifica que la API Key es válida
- Revisa las políticas de RLS

### Error: "relation does not exist"
- Ejecuta el script `database/schema.sql` en Supabase
- Verifica que todas las tablas se crearon correctamente

## Próximos Pasos

1. **Autenticación**: Implementar autenticación de usuarios
2. **Políticas RLS**: Configurar políticas de seguridad más restrictivas
3. **Backup**: Configurar backups automáticos
4. **Monitoreo**: Implementar logging y monitoreo
5. **Testing**: Añadir tests unitarios e integración
