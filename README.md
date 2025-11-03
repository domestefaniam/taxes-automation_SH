## Property Tax Agent (React + Vite + Tailwind)

Aplicación web para un agente de Property Taxes que permite:

- Registrar pagos de impuestos de propiedades
- Consultar propiedades registradas
- Ver pagos pendientes
- Obtener un resumen financiero

### Estructura del proyecto

```
.
├─ public/
├─ src/
│  ├─ components/
│  │  └─ PropertyTaxAgent.jsx
│  ├─ styles/
│  │  └─ index.css
│  ├─ App.jsx
│  └─ main.jsx
├─ .gitignore
├─ index.html
├─ package.json
├─ postcss.config.js
├─ tailwind.config.js
└─ vite.config.js
```

### Tecnologías usadas

- React 18
- Vite
- Tailwind CSS
- lucide-react

### Requisitos Previos

- Node.js 18+ y npm 9+

### Instalación

```bash
npm install
```

### Ejecutar en desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`.

### Build de producción

```bash
npm run build
npm run preview
```

### Configuración de Tailwind (resumen)

- `tailwind.config.js` con paths `./index.html` y `./src/**/*.{js,jsx,ts,tsx}`
- `src/styles/index.css` incluye `@tailwind base; @tailwind components; @tailwind utilities;`

### Notas

- El componente principal es `PropertyTaxAgent.jsx` y se utiliza desde `App.jsx`.

### Comandos de Git y GitHub

```bash
# 1) Inicializar el repositorio
git init

# 2) Primer commit
git add .
git commit -m "chore: proyecto inicial (React + Vite + Tailwind)"

# 3) Conectar con GitHub (reemplaza <USER> y <REPO>)
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git

# 4) Subir el código
git push -u origin main
```

### Conexión con Supabase

```bash
# Instalar la CLI de Supabase (si no la tienes)
npm i -g supabase

# Iniciar sesión en Supabase (se abrirá el navegador)
supabase login

# Vincular el proyecto local a tu proyecto en Supabase (reemplaza <REF_ID>)
supabase link --project-ref <REF_ID>

# Verificar estado del proyecto
supabase status
```

Para usar Supabase desde la app, instala las dependencias del cliente y crea una instancia:

```bash
npm i @supabase/supabase-js
```

```js
// Ejemplo de cliente (src/lib/supabaseClient.js)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```


