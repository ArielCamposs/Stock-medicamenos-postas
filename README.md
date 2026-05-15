# Inventario medicamentos — Postas rurales

Aplicación web interna para inventario y consumo de medicamentos en varias postas (sin pacientes ni ficha clínica). Stack: **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Supabase** (Postgres + Auth), despliegue pensado en **Vercel** + **Supabase**.

## Requisitos previos

- **Node.js** 20 o superior (recomendado LTS).
- Cuenta en [Supabase](https://supabase.com) con un proyecto creado (desarrollo y otro para producción recomendado).
- Cuenta en [Vercel](https://vercel.com) si vas a desplegar allí.

## Primeros pasos en local

1. Clona o abre el repositorio y en la raíz del proyecto instala dependencias:

   ```bash
   npm install
   ```

2. Copia las variables de entorno de ejemplo:

   ```bash
   cp .env.example .env.local
   ```

   En Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Edita `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave publicable / anon del dashboard de Supabase → **Settings** → **API**). No subas `.env.local` al repositorio.

4. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando        | Descripción                |
|----------------|----------------------------|
| `npm run dev`  | Desarrollo (Turbopack)     |
| `npm run build`| Compilación de producción  |
| `npm run start`| Servidor de producción local |
| `npm run lint` | ESLint                     |

## Variables de entorno

| Variable                              | Obligatororia | Descripción |
|---------------------------------------|---------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL`           | Sí           | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí (o anon) | Clave **pública** (anon / publishable). Nunca la `service_role` en el cliente. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Alternativa  | En proyectos antiguos que aún usan este nombre. |
| `NEXT_PUBLIC_SITE_URL`               | Opcional     | URL base para enlaces de autenticación en producción. |

El archivo **`.env.example`** en la raíz documenta los mismos nombres. La clave secreta de servicio (**service role**) solo debe usarse en entornos de servidor muy acotados (por ejemplo herramientas de administración fuera del navegador), no en el bundle de Next.js del cliente.

## Estructura relevante

- `app/` — rutas App Router (páginas y layouts).
- `components/` — UI; `components/ui/` pertenece a **shadcn/ui**.
- `lib/supabase/` — clientes Supabase SSR y navegador; validación de variables públicas.

El **middleware** actualiza/refresca la sesión JWT cuando están definidas las variables públicas. La protección estricta de rutas por rol se añadirá en una fase posterior del plan (`(auth)`, guards en servidor, RLS en Postgres).

## Base de datos (migración inicial)

El esquema (tablas, extensiones `citext`, índices, triggers `updated_at` y **RLS** por rol) está en:

`supabase/migrations/20260511194800_initial_schema.sql`

**Aplicarlo en tu proyecto hosted Supabase**

1. **SQL Editor**: pega todo el contenido del archivo y ejecútalo una sola vez, **o**
2. Con [Supabase CLI](https://supabase.com/docs/guides/cli) enlazado al proyecto (`supabase login`, `supabase link`), ejecuta `supabase db push` cuando tengas el remoto configurado.

**Alto del primer `ADMIN_GENERAL`**

Las políticas RLS solo permiten que un usuario ya autenticado con rol admin inserte filas en `perfiles_usuario`. Para el **primer** administrador, usa el rol **service role** en el SQL Editor (pestaña con privilegio elevado) o la consola donde RLS no aplique:

1. Crea la fila correspondiente del usuario en **Authentication**.
2. Inserta una fila en `public.perfiles_usuario` con `id = <uuid auth.users>` y `rol = 'ADMIN_GENERAL'`, `posta_id = null`.

A partir de ahí ese admin puede dar de alta el resto de usuarios/perfiles desde la app o con políticas compatibles.

**`citext`**

La migración declara `create extension if not exists citext with schema extensions`. El campo `email` usa el tipo calificado `extensions.citext` para evitar el error «type citext does not exist» si la extensión vive fuera del `search_path` por defecto.

## Supabase y Vercel

1. Crea un proyecto en Supabase (dev y prod si aplica).
2. En Vercel, conecta el repositorio y define las mismas variables `NEXT_PUBLIC_*` en **Project → Settings → Environment Variables** para *Production* y *Preview*.
3. En Supabase → **Authentication** → **URL configuration**, añade la URL de tu app en Vercel (y `http://localhost:3000` para desarrollo) como **Site URL** y **Redirect URLs** permitidas.

## Nota sobre el nombre de la carpeta del workspace

Si la carpeta del proyecto en disco tiene mayúsculas, `create-next-app` puede rechazar el nombre del paquete npm; el `package.json` usa el nombre `medicamentos-insumos-postas` en minúsculas.

## Próximas fases (plan acordado)

1. ~~Migración inicial SQL + RLS~~ (lista en este repo).  
2. Triggers/RPC para recálculo de stock mensual si lo concentráis en la base (opción alternativa: solo Server Actions).  
3. Login, perfiles por rol/posta y protección de rutas.  
4. Pantallas ADMIN y POSTA (consumos, ingresos, pedidos).

---

Desarrollo con responsabilidad: datos de uso interno — aplicar políticas RLS y auditoría antes de exponer cualquier ambiente público no deseado.
