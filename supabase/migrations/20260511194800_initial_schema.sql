/*
  Migración inicial — inventario medicamentos por postas
  - Extensión citext (case-insensitive email)
  - Enums + tablas + índices
  - RLS alineado a ADMIN_GENERAL | POSTA_MANAGER | READ_ONLY
  Notas:
  - Alta del primer ADMIN_GENERAL: ejecutar desde SQL Editor con rol service_role / dashboard
    o bien insertando en auth.users desde Supabase Auth y fila en public.perfiles_usuario.
  - Recálculos agregados de stock/consumos: siguiente iteración (triggers/RPC desde la app).
*/

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.role_user as enum (
  'ADMIN_GENERAL',
  'POSTA_MANAGER',
  'READ_ONLY'
);

create type public.tipo_origen_ingreso as enum (
  'COMPRA',
  'TRASLADO',
  'AJUSTE',
  'OTRO'
);

create type public.estado_pedido as enum (
  'BORRADOR',
  'ENVIADO',
  'APROBADO'
);

-- -----------------------------------------------------------------------------
-- Helpers: updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.postas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text unique,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.perfiles_usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext unique,
  nombre text,
  rol public.role_user not null default 'POSTA_MANAGER',
  posta_id uuid references public.postas (id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_admin_sin_posta check (
    (rol <> 'ADMIN_GENERAL'::public.role_user) or posta_id is null
  ),
  constraint chk_manager_con_posta check (
    (rol <> 'POSTA_MANAGER'::public.role_user) or posta_id is not null
  )
);

comment on table public.perfiles_usuario is
  'Perfil autoritativo por usuario. Roles y postas: usar solo estas filas en RLS, no JWT user_metadata editable.';

create table public.medicamentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo_interno text not null unique,
  codigo_avis text unique,
  unidad_medida text not null,
  stock_recomendado_default int not null default 0
    constraint ck_med_rec_non_negative check (stock_recomendado_default >= 0),
  stock_critico_default int not null default 0
    constraint ck_med_crit_non_negative check (stock_critico_default >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_med_crit_le_rec check (stock_critico_default <= stock_recomendado_default)
);

create table public.stock_mensual_posta (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  medicamento_id uuid not null references public.medicamentos (id) on delete restrict,
  anio int not null constraint ck_stock_anio check (anio between 2020 and 2100),
  mes int not null constraint ck_stock_mes check (mes between 1 and 12),
  stock_inicial int not null default 0 constraint ck_stock_inicial_nonneg check (stock_inicial >= 0),
  stock_ingresado_mes int not null default 0
    constraint ck_stock_ingr_nonneg check (stock_ingresado_mes >= 0),
  stock_final int not null default 0 constraint ck_stock_final_nonneg check (stock_final >= 0),
  stock_critico_config int not null default 0
    constraint ck_stock_crit_cfg_nonneg check (stock_critico_config >= 0),
  stock_recomendado_config int not null default 0
    constraint ck_stock_rec_cfg_nonneg check (stock_recomendado_config >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posta_id, medicamento_id, anio, mes),
  constraint ck_stock_cfg_crit_le_rec check (stock_critico_config <= stock_recomendado_config)
);

create table public.movimientos_diarios_consumo (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  medicamento_id uuid not null references public.medicamentos (id) on delete restrict,
  fecha date not null,
  cantidad_con_avis int not null default 0 constraint ck_con_avis_nonneg check (cantidad_con_avis >= 0),
  cantidad_sin_avis int not null default 0 constraint ck_con_sin_nonneg check (cantidad_sin_avis >= 0),
  total_dia int generated always as (cantidad_con_avis + cantidad_sin_avis) stored,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posta_id, medicamento_id, fecha)
);

create table public.ingresos_stock_mes (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  medicamento_id uuid not null references public.medicamentos (id) on delete restrict,
  fecha date not null,
  cantidad int not null constraint ck_ingreso_cant_positive check (cantidad > 0),
  tipo_origen public.tipo_origen_ingreso not null,
  referencia text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.pedidos_mensuales (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  anio int not null,
  mes int not null constraint ck_pedido_mes check (mes between 1 and 12),
  estado public.estado_pedido not null default 'BORRADOR',
  creado_por_usuario_id uuid not null references auth.users (id),
  aprobado_por_usuario_id uuid references auth.users (id),
  fecha_creacion timestamptz not null default now(),
  fecha_aprobacion timestamptz,
  unique (posta_id, anio, mes)
);

create table public.detalle_pedido_mensual (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_mensuales (id) on delete cascade,
  medicamento_id uuid not null references public.medicamentos (id) on delete restrict,
  cantidad_sugerida int not null default 0 constraint ck_det_sugg_nonneg check (cantidad_sugerida >= 0),
  cantidad_final int not null default 0 constraint ck_det_fin_nonneg check (cantidad_final >= 0),
  observaciones text,
  unique (pedido_id, medicamento_id)
);

create table public.stock_avis_mensual (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  medicamento_id uuid not null references public.medicamentos (id) on delete restrict,
  anio int not null constraint ck_avis_anio check (anio between 2020 and 2100),
  mes int not null constraint ck_avis_mes check (mes between 1 and 12),
  stock_avis_cantidad int not null default 0
    constraint ck_avis_qty_nonneg check (stock_avis_cantidad >= 0),
  updated_at timestamptz not null default now(),
  unique (posta_id, medicamento_id, anio, mes)
);

create table public.audit_logs (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users (id),
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb,
  ip inet
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index idx_stock_mensual_posta_mes on public.stock_mensual_posta (posta_id, anio, mes);
create index idx_consumo_fecha on public.movimientos_diarios_consumo (posta_id, fecha);
create index idx_consumo_mes_med on public.movimientos_diarios_consumo (
  posta_id,
  medicamento_id,
  fecha
);
create index idx_ingresos_fecha on public.ingresos_stock_mes (posta_id, fecha);
create index idx_pedidos_estado on public.pedidos_mensuales (estado, anio, mes);
create index idx_perfiles_rol_posta on public.perfiles_usuario (rol, posta_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger postas_updated_at before update on public.postas for each row
execute function public.set_updated_at();

create trigger perfiles_updated_at before update on public.perfiles_usuario for each row
execute function public.set_updated_at();

create trigger medicamentos_updated_at before update on public.medicamentos for each row
execute function public.set_updated_at();

create trigger stock_mensual_updated_at before update on public.stock_mensual_posta for each row
execute function public.set_updated_at();

create trigger consumo_updated_at before update on public.movimientos_diarios_consumo for each row
execute function public.set_updated_at();

create trigger stock_avis_updated_at before update on public.stock_avis_mensual for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.postas enable row level security;
alter table public.perfiles_usuario enable row level security;
alter table public.medicamentos enable row level security;
alter table public.stock_mensual_posta enable row level security;
alter table public.movimientos_diarios_consumo enable row level security;
alter table public.ingresos_stock_mes enable row level security;
alter table public.pedidos_mensuales enable row level security;
alter table public.detalle_pedido_mensual enable row level security;
alter table public.stock_avis_mensual enable row level security;
alter table public.audit_logs enable row level security;

-- --- postas (lectura para cualquier usuario autenticado; alta/edición sólo ADMIN_GENERAL)
create policy postas_select_auth on public.postas for select to authenticated using (true);

create policy postas_insert_admin on public.postas for insert to authenticated
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy postas_update_admin on public.postas for update to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
)
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy postas_delete_admin on public.postas for delete to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

-- --- perfiles_usuario ---
-- Solo el propio perfil o ADMIN; READ_ONLY usa datos operativos en otras tablas sin listar PII ajena aquí.
create policy perf_select_own_or_admin on public.perfiles_usuario for select to authenticated
using (
  id = auth.uid()
  or exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy perf_insert_admin on public.perfiles_usuario for insert to authenticated
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy perf_update_own_or_admin on public.perfiles_usuario for update to authenticated
using (
    id = auth.uid()
    or exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
)
with check (
    id = auth.uid()
    or exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy perf_delete_admin on public.perfiles_usuario for delete to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

-- --- medicamentos ---
create policy meds_select_auth on public.medicamentos for select to authenticated using (true);

create policy meds_write_admin on public.medicamentos for insert to authenticated
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy meds_update_admin on public.medicamentos for update to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
)
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy meds_delete_admin on public.medicamentos for delete to authenticated
using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

-- Expresiones reutilizables (inline): ¿puede ver filas de esa posta?
-- Acceso escritura gestor sólo sobre su posta y sin rol READ_ONLY

-- --- stock_mensual_posta ---
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

create policy smp_write_mgr_admin on public.stock_mensual_posta for insert to authenticated with check (
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

create policy smp_update_mgr_admin on public.stock_mensual_posta for update to authenticated using (
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

create policy smp_delete_mgr_admin on public.stock_mensual_posta for delete to authenticated using (
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

-- --- movimientos_diarios_consumo (alias consumo en comentarios) ---
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
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = movimientos_diarios_consumo.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

create policy mdc_update on public.movimientos_diarios_consumo for update to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = movimientos_diarios_consumo.posta_id
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
            and p.posta_id = movimientos_diarios_consumo.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

create policy mdc_delete on public.movimientos_diarios_consumo for delete to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = movimientos_diarios_consumo.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

-- --- ingresos_stock_mes ---
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

create policy ing_delete on public.ingresos_stock_mes for delete to authenticated using (
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

-- Opcionalmente podrían bloquearse updates a ingresos para integridad histórica; por ahora no hay UPDATE desde UI típico.

-- --- pedidos_mensuales ---
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

create policy ped_insert on public.pedidos_mensuales for insert to authenticated with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = pedidos_mensuales.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

create policy ped_update_mgr on public.pedidos_mensuales for update to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and p.rol = 'POSTA_MANAGER'::public.role_user
        and p.posta_id = pedidos_mensuales.posta_id
        and pedidos_mensuales.estado <> 'APROBADO'::public.estado_pedido
    )
)
with check (
    estado is distinct from 'APROBADO'::public.estado_pedido
    and exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and p.rol = 'POSTA_MANAGER'::public.role_user
        and p.posta_id = pedidos_mensuales.posta_id
    )
);

create policy ped_update_admin on public.pedidos_mensuales for update to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
)
with check (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

create policy ped_delete_mgr_admin on public.pedidos_mensuales for delete to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid()
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = pedidos_mensuales.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

-- --- detalle_pedido_mensual ---
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

create policy dpm_insert on public.detalle_pedido_mensual for insert to authenticated with check (
    exists (
      select 1
      from public.pedidos_mensuales pm
      join public.perfiles_usuario p on p.id = auth.uid()
      where pm.id = detalle_pedido_mensual.pedido_id
        and pm.estado <> 'APROBADO'::public.estado_pedido
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = pm.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

create policy dpm_update on public.detalle_pedido_mensual for update to authenticated using (
    exists (
      select 1
      from public.pedidos_mensuales pm
      join public.perfiles_usuario p on p.id = auth.uid()
      where pm.id = detalle_pedido_mensual.pedido_id
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = pm.posta_id
            and pm.estado <> 'APROBADO'::public.estado_pedido
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
            and pm.estado <> 'APROBADO'::public.estado_pedido
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

create policy dpm_delete on public.detalle_pedido_mensual for delete to authenticated using (
    exists (
      select 1
      from public.pedidos_mensuales pm
      join public.perfiles_usuario p on p.id = auth.uid()
      where pm.id = detalle_pedido_mensual.pedido_id
        and pm.estado <> 'APROBADO'::public.estado_pedido
        and (
          (
            p.rol = 'POSTA_MANAGER'::public.role_user
            and p.posta_id = pm.posta_id
          )
          or p.rol = 'ADMIN_GENERAL'::public.role_user
        )
    )
);

-- --- stock_avis_mensual ---
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

create policy sam_delete on public.stock_avis_mensual for delete to authenticated using (
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

-- --- audit_logs ---
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

create policy audit_select_admin on public.audit_logs for select to authenticated using (
    exists (
      select 1 from public.perfiles_usuario p
      where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
    )
);

-- -----------------------------------------------------------------------------
-- Grants (API PostgREST: authenticated debe poder ejecutar operaciones cubiertas por RLS)
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

grant usage, select on all sequences in schema public to authenticated;
