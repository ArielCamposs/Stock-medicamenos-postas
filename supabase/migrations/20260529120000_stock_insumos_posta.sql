/*
  Stock actual de insumos por posta (registro en inicio / dashboard).
  Independiente del flujo de pedidos; la encargada puede actualizarlo cuando quiera.
*/

create table public.stock_insumos_posta (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  cantidad int not null default 0 constraint ck_stock_ins_posta_nonneg check (cantidad >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posta_id, insumo_id)
);

create trigger stock_insumos_posta_updated_at before update on public.stock_insumos_posta for each row
execute function public.set_updated_at();

create index idx_stock_insumos_posta_posta on public.stock_insumos_posta (posta_id, insumo_id);

alter table public.stock_insumos_posta enable row level security;

create policy stock_insumos_posta_select on public.stock_insumos_posta for select to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = stock_insumos_posta.posta_id)
      )
  )
);

create policy stock_insumos_posta_insert on public.stock_insumos_posta for insert to authenticated
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = stock_insumos_posta.posta_id)
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

create policy stock_insumos_posta_update on public.stock_insumos_posta for update to authenticated
using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = stock_insumos_posta.posta_id)
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (p.rol = 'POSTA_MANAGER'::public.role_user and p.posta_id = stock_insumos_posta.posta_id)
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

comment on table public.stock_insumos_posta is
  'Stock actual de insumos en cada posta; se actualiza desde el dashboard o al enviar un pedido.';
