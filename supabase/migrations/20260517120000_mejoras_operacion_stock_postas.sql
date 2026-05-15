-- Mejoras operativas para stock de postas:
-- - auditoría útil y anulaciones sin borrado físico
-- - cierre mensual por posta
-- - estados ampliados de pedidos

alter table public.perfiles_usuario
  drop constraint if exists chk_roles_operativos_con_posta;

alter table public.perfiles_usuario
  drop constraint if exists chk_manager_con_posta;

alter table public.perfiles_usuario
  add constraint chk_manager_con_posta check (
    (rol <> 'POSTA_MANAGER'::public.role_user) or posta_id is not null
  );

alter table public.movimientos_diarios_consumo
  add column if not exists observacion text,
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_por uuid references auth.users (id),
  add column if not exists anulado_en timestamptz,
  add column if not exists motivo_anulacion text;

alter table public.ingresos_stock_mes
  add column if not exists observacion text,
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_por uuid references auth.users (id),
  add column if not exists anulado_en timestamptz,
  add column if not exists motivo_anulacion text;

alter table public.stock_avis_mensual
  add column if not exists updated_by uuid references auth.users (id);

alter table public.pedidos_mensuales
  add column if not exists observado_en timestamptz,
  add column if not exists rechazado_en timestamptz,
  add column if not exists despachado_en timestamptz,
  add column if not exists recibido_en timestamptz,
  add column if not exists comentario_admin text,
  add column if not exists comentario_posta text;

create table if not exists public.cierres_mensuales_posta (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  anio int not null constraint ck_cierre_anio check (anio between 2020 and 2100),
  mes int not null constraint ck_cierre_mes check (mes between 1 and 12),
  cerrado_por uuid not null references auth.users (id),
  cerrado_en timestamptz not null default now(),
  reabierto_por uuid references auth.users (id),
  reabierto_en timestamptz,
  motivo_reapertura text,
  resumen jsonb not null default '{}'::jsonb,
  unique (posta_id, anio, mes)
);

alter table public.cierres_mensuales_posta enable row level security;

create index if not exists idx_consumo_activo_fecha
  on public.movimientos_diarios_consumo (posta_id, fecha)
  where anulado = false;

create index if not exists idx_ingresos_activos_fecha
  on public.ingresos_stock_mes (posta_id, fecha)
  where anulado = false;

create index if not exists idx_cierres_posta_mes
  on public.cierres_mensuales_posta (posta_id, anio, mes);

create or replace function public.set_created_by_from_auth()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists consumo_created_by_auth on public.movimientos_diarios_consumo;
create trigger consumo_created_by_auth
before insert on public.movimientos_diarios_consumo
for each row execute function public.set_created_by_from_auth();

drop trigger if exists ingresos_created_by_auth on public.ingresos_stock_mes;
create trigger ingresos_created_by_auth
before insert on public.ingresos_stock_mes
for each row execute function public.set_created_by_from_auth();

create or replace function public.set_stock_avis_updated_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stock_avis_updated_by_auth on public.stock_avis_mensual;
create trigger stock_avis_updated_by_auth
before insert or update on public.stock_avis_mensual
for each row execute function public.set_stock_avis_updated_by();

drop policy if exists smp_select on public.stock_mensual_posta;
drop policy if exists smp_write_mgr_admin on public.stock_mensual_posta;
drop policy if exists smp_update_mgr_admin on public.stock_mensual_posta;
drop policy if exists smp_delete_mgr_admin on public.stock_mensual_posta;

create policy smp_select on public.stock_mensual_posta for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = stock_mensual_posta.posta_id
        )
      )
  )
);

create policy smp_write_operativo_admin on public.stock_mensual_posta for insert to authenticated with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = stock_mensual_posta.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

create policy smp_update_operativo_admin on public.stock_mensual_posta for update to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = stock_mensual_posta.posta_id
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
          and p.posta_id = stock_mensual_posta.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

drop policy if exists mdc_select on public.movimientos_diarios_consumo;
drop policy if exists mdc_insert on public.movimientos_diarios_consumo;
drop policy if exists mdc_update on public.movimientos_diarios_consumo;
drop policy if exists mdc_delete on public.movimientos_diarios_consumo;

create policy mdc_select on public.movimientos_diarios_consumo for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = movimientos_diarios_consumo.posta_id
        )
      )
  )
);

create policy mdc_insert on public.movimientos_diarios_consumo for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = movimientos_diarios_consumo.posta_id
  )
);

create policy mdc_update on public.movimientos_diarios_consumo for update to authenticated using (
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

drop policy if exists ing_select on public.ingresos_stock_mes;
drop policy if exists ing_insert on public.ingresos_stock_mes;
drop policy if exists ing_update on public.ingresos_stock_mes;
drop policy if exists ing_delete on public.ingresos_stock_mes;

create policy ing_select on public.ingresos_stock_mes for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = ingresos_stock_mes.posta_id
        )
      )
  )
);

create policy ing_insert on public.ingresos_stock_mes for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
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

drop policy if exists ped_select on public.pedidos_mensuales;
drop policy if exists dpm_select on public.detalle_pedido_mensual;

create policy ped_select on public.pedidos_mensuales for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pedidos_mensuales.posta_id
        )
      )
  )
);

create policy dpm_select on public.detalle_pedido_mensual for select to authenticated using (
  exists (
    select 1
    from public.pedidos_mensuales pm
    join public.perfiles_usuario p on p.id = auth.uid()
    where pm.id = detalle_pedido_mensual.pedido_id
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = pm.posta_id
        )
      )
  )
);

drop policy if exists sam_select on public.stock_avis_mensual;
drop policy if exists sam_write on public.stock_avis_mensual;
drop policy if exists sam_update on public.stock_avis_mensual;
drop policy if exists sam_delete on public.stock_avis_mensual;

create policy sam_select on public.stock_avis_mensual for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = stock_avis_mensual.posta_id
        )
      )
  )
);

create policy sam_write on public.stock_avis_mensual for insert to authenticated with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = stock_avis_mensual.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

create policy sam_update on public.stock_avis_mensual for update to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = stock_avis_mensual.posta_id
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
          and p.posta_id = stock_avis_mensual.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = any (
        array[
          'ADMIN_GENERAL'::public.role_user,
          'POSTA_MANAGER'::public.role_user
        ]
      )
  )
);

create policy cierres_select on public.cierres_mensuales_posta for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = cierres_mensuales_posta.posta_id
        )
      )
  )
);

create policy cierres_insert_operativo on public.cierres_mensuales_posta for insert to authenticated with check (
  cerrado_por = auth.uid()
  and exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = cierres_mensuales_posta.posta_id
  )
);

create policy cierres_update_admin on public.cierres_mensuales_posta for update to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'ADMIN_GENERAL'::public.role_user
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'ADMIN_GENERAL'::public.role_user
  )
);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
