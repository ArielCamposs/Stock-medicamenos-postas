-- Permitir a administración general quitar stock de insumos al eliminar del catálogo
create policy stock_insumos_posta_delete_admin on public.stock_insumos_posta for delete to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
  )
);
