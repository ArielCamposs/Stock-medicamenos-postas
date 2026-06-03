-- Ingresos de stock: solo POSTA_MANAGER de la misma posta (admin/supervisión solo lectura).

drop policy if exists ing_insert on public.ingresos_stock_mes;
create policy ing_insert on public.ingresos_stock_mes for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = ingresos_stock_mes.posta_id
  )
);

drop policy if exists ing_lote_insert on public.ingresos_stock_lotes;
create policy ing_lote_insert on public.ingresos_stock_lotes for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = ingresos_stock_lotes.posta_id
  )
);
