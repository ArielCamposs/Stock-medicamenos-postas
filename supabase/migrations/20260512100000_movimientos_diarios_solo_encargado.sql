-- Descuentos diarios: solo POSTA_MANAGER de la misma posta (no ADMIN_GENERAL).
-- La app ya restringe; esto alinea RLS con la regla de negocio.

drop policy if exists mdc_insert on public.movimientos_diarios_consumo;
drop policy if exists mdc_update on public.movimientos_diarios_consumo;
drop policy if exists mdc_delete on public.movimientos_diarios_consumo;

create policy mdc_insert on public.movimientos_diarios_consumo for insert to authenticated
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and p.rol = 'POSTA_MANAGER'::public.role_user
        and p.posta_id = movimientos_diarios_consumo.posta_id
    )
);

create policy mdc_update on public.movimientos_diarios_consumo for update to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and p.rol = 'POSTA_MANAGER'::public.role_user
        and p.posta_id = movimientos_diarios_consumo.posta_id
    )
)
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and p.rol = 'POSTA_MANAGER'::public.role_user
        and p.posta_id = movimientos_diarios_consumo.posta_id
    )
);

create policy mdc_delete on public.movimientos_diarios_consumo for delete to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and p.rol = 'POSTA_MANAGER'::public.role_user
        and p.posta_id = movimientos_diarios_consumo.posta_id
    )
);
