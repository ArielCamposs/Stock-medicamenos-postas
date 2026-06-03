/*
  Asignar rol BODEGA_FARMACIA a un usuario que ya existe en Authentication.

  1. El usuario debe estar creado en Supabase → Authentication → Users.
  2. Cambiá solo el correo en la línea del WHERE.
  3. Ejecutá en SQL Editor del mismo proyecto que usa la app.
*/

insert into public.perfiles_usuario (id, email, nombre, rol, posta_id, activo)
select
  u.id,
  u.email::extensions.citext,
  'Encargado bodega',
  'BODEGA_FARMACIA'::public.role_user,
  null,
  true
from auth.users u
where lower(trim(u.email)) = lower(trim('tu-email@ejemplo.com'))
limit 1
on conflict (id) do update set
  email = excluded.email,
  nombre = coalesce(public.perfiles_usuario.nombre, excluded.nombre),
  rol = 'BODEGA_FARMACIA'::public.role_user,
  posta_id = null,
  activo = true;

-- Comprobación (debe devolver 1 fila con rol BODEGA_FARMACIA y posta_id null):
-- select p.id, p.email, p.nombre, p.rol, p.posta_id, p.activo
-- from auth.users u
-- join public.perfiles_usuario p on p.id = u.id
-- where lower(trim(u.email)) = lower(trim('tu-email@ejemplo.com'));
