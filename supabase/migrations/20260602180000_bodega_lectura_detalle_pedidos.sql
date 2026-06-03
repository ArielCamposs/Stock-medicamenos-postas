-- Bodega debe ver líneas de pedidos (PDF, totales en /bodega, etc.).

drop policy if exists dpm_select on public.detalle_pedido_mensual;

create policy dpm_select on public.detalle_pedido_mensual for select to authenticated
using (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and (
        p.rol in (
          'ADMIN_GENERAL'::public.role_user,
          'READ_ONLY'::public.role_user,
          'BODEGA_FARMACIA'::public.role_user
        )
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pm.posta_id
        )
      )
  )
);

drop policy if exists detalle_insumos_select on public.detalle_pedido_insumos;

create policy detalle_insumos_select on public.detalle_pedido_insumos for select to authenticated
using (
  exists (
    select 1
    from public.pedidos_insumos pi
    join public.perfiles_usuario p on p.id = auth.uid()
    where pi.id = detalle_pedido_insumos.pedido_id
      and (
        p.rol in (
          'ADMIN_GENERAL'::public.role_user,
          'READ_ONLY'::public.role_user,
          'BODEGA_FARMACIA'::public.role_user
        )
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pi.posta_id
        )
      )
  )
);
