/*
  Encargada/o general — puede ingresar sin posta (posta_id = NULL)

  IMPORTANTE — constraint chk_admin_sin_posta:
  ADMIN_GENERAL implica siempre posta_id = NULL. Si ves ERROR 23514 al guardar,
  estás dejando posta_id con un UUID; quitá la posta o usá
  snippets/promover_a_admin_general.sql

  En este proyecto solo estos roles ven el panel global sin estar atados a una posta:
  - ADMIN_GENERAL (gestión completa: postas, medicamentos, aprobar pedidos, etc.)
  - READ_ONLY (solo lectura en vistas globales; opcional)

  POSTA_MANAGER siempre debe tener posta_id apuntando a public.postas.

  Pasos:
  1. Authentication → Users → crear la cuenta nueva (email / contraseña).
  2. Copiar el User UID (UUID).
  3. Sustituir los tres placeholders en el INSERT de abajo y ejecutar en SQL Editor.
*/

insert into public.perfiles_usuario (id, email, nombre, rol, posta_id, activo)
values (
  'PEGÁ-AQUÍ-EL-UUID-DE-AUTH-USERS'::uuid,
  'mismo-email-que-en-auth@ejemplo.com'::extensions.citext,
  'Nombre opcional',
  'ADMIN_GENERAL'::public.role_user,
  null,
  true
)
on conflict (id) do update set
  email = excluded.email,
  nombre = coalesce(excluded.nombre, public.perfiles_usuario.nombre),
  rol = 'ADMIN_GENERAL'::public.role_user,
  posta_id = null,
  activo = true;
