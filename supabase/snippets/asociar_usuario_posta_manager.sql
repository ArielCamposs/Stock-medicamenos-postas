-- =============================================================================
-- Asociar usuario → POSTA_MANAGER con posta_id (public.perfiles_usuario)
-- =============================================================================
-- Si ves ERROR 23503 / perfiles_usuario_posta_id_fkey: el posta_id NO existe en
-- public.postas en ESTE proyecto (UUID equivocado, otro entorno Supabase, o la
-- posta todavía no se cargó acá). Siempre ejecutá el PASO 1 en el mismo SQL
-- Editor / mismo proyecto donde está tu app (.env).
--
-- El PASO 2 usa INSERT ... ON CONFLICT: sirve aunque el usuario exista solo en
-- auth.users (sin fila en perfiles_usuario). Un UPDATE solo no crea el perfil.
-- Ejecutá con rol que pueda leer auth.users (p. ej. SQL Editor / service_role).
-- =============================================================================

-- PASO 1 — Listar postas reales de esta base (copiá un `id` de acá):
select id, nombre, codigo, activa
from public.postas
order by nombre;

-- PASO 1b — Comprobar que el UUID que vas a usar existe (reemplazá el valor):
-- select exists (
--   select 1 from public.postas where id = 'PEGÁ_ACÁ_EL_UUID'::uuid
-- );

-- PASO 2 — Crear o actualizar perfil + asignar posta (reemplazá email y UUID):

insert into public.perfiles_usuario (id, email, nombre, rol, posta_id, activo)
select
  u.id,
  u.email::extensions.citext,
  null,
  'POSTA_MANAGER'::public.role_user,
  'PEGÁ_ACÁ_UUID_DE_LA_TABLA_POSTAS'::uuid,
  true
from auth.users u
where lower(trim(coalesce(u.email::text, ''))) = lower(trim('tu-correo@ejemplo.com'))
limit 1
on conflict (id) do update set
  email = excluded.email,
  nombre = coalesce(excluded.nombre, public.perfiles_usuario.nombre),
  rol = 'POSTA_MANAGER'::public.role_user,
  posta_id = excluded.posta_id,
  activo = true;

-- PASO 3 — Verificación (debe devolver 1 fila con rol POSTA_MANAGER y posta_id):
-- select pu.id, pu.email, pu.rol, pu.posta_id, p.nombre as posta_nombre
-- from public.perfiles_usuario pu
-- left join public.postas p on p.id = pu.posta_id
-- join auth.users au on au.id = pu.id
-- where lower(trim(coalesce(au.email::text, ''))) = lower(trim('tu-correo@ejemplo.com'));
