-- Eliminar insumos del catálogo (solo administración general)
create policy insumos_delete_admin on public.insumos for delete to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
  )
);
