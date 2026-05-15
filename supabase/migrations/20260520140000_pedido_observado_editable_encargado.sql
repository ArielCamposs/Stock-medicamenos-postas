-- Encargado: editar líneas y reenviar cuando administración dejó el pedido en OBSERVADO
-- (antes solo BORRADOR; sin esto el upsert del detalle fallaba por RLS y la UI parecía “sin pedido”).

drop policy if exists dpm_insert on public.detalle_pedido_mensual;
drop policy if exists dpm_update on public.detalle_pedido_mensual;
drop policy if exists dpm_delete on public.detalle_pedido_mensual;
drop policy if exists ped_update_mgr on public.pedidos_mensuales;

create policy dpm_insert on public.detalle_pedido_mensual for insert to authenticated
with check (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and pm.estado in (
        'BORRADOR'::public.estado_pedido,
        'OBSERVADO'::public.estado_pedido
      )
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pm.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

create policy dpm_update on public.detalle_pedido_mensual for update to authenticated
using (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pm.posta_id
          and pm.estado in (
            'BORRADOR'::public.estado_pedido,
            'OBSERVADO'::public.estado_pedido
          )
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
)
with check (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pm.posta_id
          and pm.estado in (
            'BORRADOR'::public.estado_pedido,
            'OBSERVADO'::public.estado_pedido
          )
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

create policy dpm_delete on public.detalle_pedido_mensual for delete to authenticated
using (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and pm.estado in (
        'BORRADOR'::public.estado_pedido,
        'OBSERVADO'::public.estado_pedido
      )
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pm.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

create policy ped_update_mgr on public.pedidos_mensuales for update to authenticated
using (
  exists (
    select 1
    from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pedidos_mensuales.posta_id
      and pedidos_mensuales.estado in (
        'BORRADOR'::public.estado_pedido,
        'OBSERVADO'::public.estado_pedido
      )
  )
)
with check (
  exists (
    select 1
    from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pedidos_mensuales.posta_id
  )
  and pedidos_mensuales.estado in (
    'BORRADOR'::public.estado_pedido,
    'ENVIADO'::public.estado_pedido
  )
  and pedidos_mensuales.estado is distinct from 'APROBADO'::public.estado_pedido
);
