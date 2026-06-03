-- Recepción de pedido mensual por la posta: cantidades recibidas y paso a RECIBIDO.

alter table public.detalle_pedido_mensual
  add column if not exists cantidad_recibida int
  constraint ck_det_cant_recibida_nonneg check (cantidad_recibida is null or cantidad_recibida >= 0);

comment on column public.detalle_pedido_mensual.cantidad_recibida is
  'Unidades efectivamente recibidas al confirmar despacho; null hasta la recepción en posta.';

drop policy if exists ped_update_mgr_recepcion on public.pedidos_mensuales;

create policy ped_update_mgr_recepcion on public.pedidos_mensuales for update to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pedidos_mensuales.posta_id
      and pedidos_mensuales.estado = 'DESPACHADO'::public.estado_pedido
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pedidos_mensuales.posta_id
  )
  and pedidos_mensuales.estado in (
    'DESPACHADO'::public.estado_pedido,
    'RECIBIDO'::public.estado_pedido
  )
);

drop policy if exists dpm_update_mgr_recepcion on public.detalle_pedido_mensual;

create policy dpm_update_mgr_recepcion on public.detalle_pedido_mensual for update to authenticated
using (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and pm.posta_id = p.posta_id
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and pm.estado = 'DESPACHADO'::public.estado_pedido
  )
)
with check (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and pm.posta_id = p.posta_id
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and pm.estado = 'DESPACHADO'::public.estado_pedido
  )
);
