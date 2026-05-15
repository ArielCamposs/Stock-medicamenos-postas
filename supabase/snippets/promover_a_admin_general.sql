/*
  Promover usuario a ADMIN_GENERAL (panel global de supervisión + catálogo).

  ERROR 23514 chk_admin_sin_posta:
  Si rol = ADMIN_GENERAL, posta_id DEBE ser NULL. No puede ser encargado de una
  sede y admin global a la vez en este modelo.

  Reemplazá el email por el de la cuenta (el mismo que en Authentication).
*/

update public.perfiles_usuario pu
set
  rol = 'ADMIN_GENERAL'::public.role_user,
  posta_id = null,
  activo = true,
  updated_at = now()
from auth.users au
where pu.id = au.id
  and au.email = 'admin@admin.cl'; -- <-- tu email

-- Verificación:
-- select pu.email, pu.rol, pu.posta_id
-- from public.perfiles_usuario pu
-- join auth.users au on au.id = pu.id
-- where au.email = 'admin@admin.cl';
