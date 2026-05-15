-- Permitir corregir cantidad de un ingreso (POSTA_MANAGER / ADMIN_GENERAL).

create policy ing_update on public.ingresos_stock_mes for update to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = ingresos_stock_mes.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
)
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = ingresos_stock_mes.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);
