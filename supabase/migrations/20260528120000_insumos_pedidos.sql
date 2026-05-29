/*
  Módulo de pedidos de insumos (no medicamentos)
  - Catálogo de insumos (manejado por ADMIN_GENERAL)
  - Pedidos simples: posta registra stock_objetivo y stock_actual → cantidad = max(0, objetivo - actual)
  - Flujo: BORRADOR → ENVIADO → APROBADO | OBSERVADO | RECHAZADO → RECIBIDO
*/

-- -----------------------------------------------------------------------------
-- Tabla catálogo de insumos
-- -----------------------------------------------------------------------------
create table public.insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  unidad_medida text not null default 'unidad',
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger insumos_updated_at before update on public.insumos for each row
execute function public.set_updated_at();

create index idx_insumos_activo_orden on public.insumos (activo, orden, nombre);

-- -----------------------------------------------------------------------------
-- Tabla cabecera de pedidos de insumos
-- -----------------------------------------------------------------------------
create table public.pedidos_insumos (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  estado public.estado_pedido not null default 'BORRADOR',
  comentario_admin text,
  creado_por_usuario_id uuid not null references auth.users (id),
  enviado_en timestamptz,
  observado_en timestamptz,
  rechazado_en timestamptz,
  aprobado_por_usuario_id uuid references auth.users (id),
  fecha_aprobacion timestamptz,
  recibido_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pedidos_insumos_updated_at before update on public.pedidos_insumos for each row
execute function public.set_updated_at();

create index idx_pedidos_insumos_posta on public.pedidos_insumos (posta_id, created_at desc);
create index idx_pedidos_insumos_estado on public.pedidos_insumos (estado, created_at desc);

-- -----------------------------------------------------------------------------
-- Tabla detalle de pedidos de insumos
-- -----------------------------------------------------------------------------
create table public.detalle_pedido_insumos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_insumos (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  stock_objetivo int not null default 0 constraint ck_det_ins_obj_nonneg check (stock_objetivo >= 0),
  stock_actual int not null default 0 constraint ck_det_ins_act_nonneg check (stock_actual >= 0),
  cantidad_pedido int not null default 0 constraint ck_det_ins_cant_nonneg check (cantidad_pedido >= 0),
  unique (pedido_id, insumo_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger detalle_pedido_insumos_updated_at before update on public.detalle_pedido_insumos for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.insumos enable row level security;
alter table public.pedidos_insumos enable row level security;
alter table public.detalle_pedido_insumos enable row level security;

-- insumos: lectura para todos los autenticados; escritura solo ADMIN_GENERAL
create policy insumos_select_auth on public.insumos for select to authenticated using (true);

create policy insumos_insert_admin on public.insumos for insert to authenticated
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid() and p.rol = 'ADMIN_GENERAL'::public.role_user
  )
);

create policy insumos_update_admin on public.insumos for update to authenticated
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

-- pedidos_insumos: POSTA_MANAGER ve solo los de su posta; admin/readonly ve todos
create policy pedidos_insumos_select on public.pedidos_insumos for select to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = posta_id)
      )
  )
);

create policy pedidos_insumos_insert_manager on public.pedidos_insumos for insert to authenticated
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = posta_id
  )
);

create policy pedidos_insumos_update_allowed on public.pedidos_insumos for update to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol = 'ADMIN_GENERAL'::public.role_user
        or (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = posta_id)
      )
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol = 'ADMIN_GENERAL'::public.role_user
        or (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = posta_id)
      )
  )
);

-- detalle: acceso vía pedido (mismas reglas de visibilidad)
create policy detalle_insumos_select on public.detalle_pedido_insumos for select to authenticated
using (
  exists (
    select 1 from public.pedidos_insumos pi
    join public.perfiles_usuario p on p.id = auth.uid()
    where pi.id = pedido_id
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = pi.posta_id)
      )
  )
);

create policy detalle_insumos_insert_manager on public.detalle_pedido_insumos for insert to authenticated
with check (
  exists (
    select 1 from public.pedidos_insumos pi
    join public.perfiles_usuario p on p.id = auth.uid()
    where pi.id = pedido_id
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pi.posta_id
      and pi.estado = 'BORRADOR'::public.estado_pedido
  )
);

create policy detalle_insumos_update_manager on public.detalle_pedido_insumos for update to authenticated
using (
  exists (
    select 1 from public.pedidos_insumos pi
    join public.perfiles_usuario p on p.id = auth.uid()
    where pi.id = pedido_id
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pi.posta_id
      and pi.estado in ('BORRADOR'::public.estado_pedido, 'OBSERVADO'::public.estado_pedido)
  )
)
with check (
  exists (
    select 1 from public.pedidos_insumos pi
    join public.perfiles_usuario p on p.id = auth.uid()
    where pi.id = pedido_id
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pi.posta_id
      and pi.estado in ('BORRADOR'::public.estado_pedido, 'OBSERVADO'::public.estado_pedido)
  )
);

create policy detalle_insumos_delete_manager on public.detalle_pedido_insumos for delete to authenticated
using (
  exists (
    select 1 from public.pedidos_insumos pi
    join public.perfiles_usuario p on p.id = auth.uid()
    where pi.id = pedido_id
      and p.rol = 'POSTA_MANAGER'::public.role_user
      and p.posta_id = pi.posta_id
      and pi.estado in ('BORRADOR'::public.estado_pedido, 'OBSERVADO'::public.estado_pedido)
  )
);
