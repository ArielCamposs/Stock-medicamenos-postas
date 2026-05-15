/*
  Asignar ADMIN_GENERAL usando el mismo id que auth.users (evita UUID equivocado).

  1. Cambiá solo el literal del email abajo (el mismo que usás para iniciar sesión).
  2. Ejecutá en SQL Editor del MISMO proyecto Supabase que usa tu .env.
*/

insert into public.perfiles_usuario (id, email, nombre, rol, posta_id, activo)
select
  u.id,
  u.email::extensions.citext,
  null,
  'ADMIN_GENERAL'::public.role_user,
  null,
  true
from auth.users u
where lower(trim(u.email)) = lower(trim('tu-email@ejemplo.com'))
limit 1
on conflict (id) do update set
  email = excluded.email,
  rol = 'ADMIN_GENERAL'::public.role_user,
  posta_id = null,
  activo = true;

-- Comprobación (debe devolver 1 fila con rol ADMIN_GENERAL):
-- select p.*
-- from auth.users u
-- join public.perfiles_usuario p on p.id = u.id
-- where lower(trim(u.email)) = lower(trim('tu-email@ejemplo.com'));
