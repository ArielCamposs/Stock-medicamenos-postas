-- Paso 2/2: constraints, login y RLS para BODEGA_FARMACIA (requiere migración 20260602160000 aplicada).

alter table public.perfiles_usuario
  drop constraint if exists chk_admin_sin_posta;

alter table public.perfiles_usuario
  add constraint chk_roles_central_sin_posta check (
    (
      rol not in (
        'ADMIN_GENERAL'::public.role_user,
        'BODEGA_FARMACIA'::public.role_user
      )
    )
    or posta_id is null
  );

comment on type public.role_user is
  'ADMIN_GENERAL: catálogo y bandeja. BODEGA_FARMACIA: despacho a postas. POSTA_MANAGER: operación en sede. READ_ONLY: supervisión.';

create or replace function public.verificar_correo_login(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_perfil public.perfiles_usuario%rowtype;
begin
  v_norm := lower(trim(coalesce(p_email, '')));
  if v_norm = '' then
    return 'correo_invalido';
  end if;

  if not exists (
    select 1
    from auth.users u
    where lower(trim(coalesce(u.email::text, ''))) = v_norm
  ) then
    return 'no_encontrado';
  end if;

  select *
  into v_perfil
  from public.perfiles_usuario pu
  where lower(pu.email::text) = v_norm
  limit 1;

  if not found then
    return 'sin_perfil';
  end if;

  if not v_perfil.activo then
    return 'inactivo';
  end if;

  if v_perfil.rol = 'POSTA_MANAGER'::public.role_user and v_perfil.posta_id is null then
    return 'sin_posta';
  end if;

  if v_perfil.rol = 'ADMIN_GENERAL'::public.role_user and v_perfil.posta_id is not null then
    return 'perfil_inconsistente';
  end if;

  if v_perfil.rol = 'BODEGA_FARMACIA'::public.role_user and v_perfil.posta_id is not null then
    return 'perfil_inconsistente';
  end if;

  return 'ok';
end;
$$;

drop policy if exists ped_select on public.pedidos_mensuales;

create policy ped_select on public.pedidos_mensuales for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in (
          'ADMIN_GENERAL'::public.role_user,
          'READ_ONLY'::public.role_user,
          'BODEGA_FARMACIA'::public.role_user
        )
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pedidos_mensuales.posta_id
        )
      )
  )
);

drop policy if exists ped_update_bodega on public.pedidos_mensuales;

create policy ped_update_bodega on public.pedidos_mensuales for update to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'BODEGA_FARMACIA'::public.role_user
      and p.activo = true
  )
  and pedidos_mensuales.estado = 'APROBADO'::public.estado_pedido
)
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'BODEGA_FARMACIA'::public.role_user
      and p.activo = true
  )
  and estado = 'DESPACHADO'::public.estado_pedido
);

drop policy if exists pedidos_insumos_select on public.pedidos_insumos;

create policy pedidos_insumos_select on public.pedidos_insumos for select to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in (
          'ADMIN_GENERAL'::public.role_user,
          'READ_ONLY'::public.role_user,
          'BODEGA_FARMACIA'::public.role_user
        )
        or (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = posta_id)
      )
  )
);

drop policy if exists pedidos_insumos_update_bodega on public.pedidos_insumos;

create policy pedidos_insumos_update_bodega on public.pedidos_insumos for update to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'BODEGA_FARMACIA'::public.role_user
      and p.activo = true
  )
  and pedidos_insumos.estado = 'APROBADO'::public.estado_pedido
)
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'BODEGA_FARMACIA'::public.role_user
      and p.activo = true
  )
  and estado = 'DESPACHADO'::public.estado_pedido
);
