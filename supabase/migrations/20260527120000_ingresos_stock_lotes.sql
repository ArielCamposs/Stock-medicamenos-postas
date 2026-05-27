-- Agrupa líneas de ingresos_stock_mes en un «ingreso» (evento) por cada registro desde la UI.

create table if not exists public.ingresos_stock_lotes (
  id uuid primary key default gen_random_uuid(),
  posta_id uuid not null references public.postas (id) on delete restrict,
  fecha date not null,
  tipo_origen public.tipo_origen_ingreso not null,
  referencia text,
  observacion text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_ingresos_lotes_posta_created
  on public.ingresos_stock_lotes (posta_id, created_at desc);

alter table public.ingresos_stock_mes
  add column if not exists lote_id uuid references public.ingresos_stock_lotes (id) on delete restrict;

create index if not exists idx_ingresos_stock_mes_lote
  on public.ingresos_stock_mes (lote_id);

alter table public.ingresos_stock_lotes enable row level security;

drop trigger if exists ingresos_lotes_created_by_auth on public.ingresos_stock_lotes;
create trigger ingresos_lotes_created_by_auth
before insert on public.ingresos_stock_lotes
for each row execute function public.set_created_by_from_auth();

drop policy if exists ing_lote_select on public.ingresos_stock_lotes;
drop policy if exists ing_lote_insert on public.ingresos_stock_lotes;

create policy ing_lote_select on public.ingresos_stock_lotes for select to authenticated using (
  exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        p.rol in ('ADMIN_GENERAL'::public.role_user, 'READ_ONLY'::public.role_user)
        or (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = ingresos_stock_lotes.posta_id
        )
      )
  )
);

create policy ing_lote_insert on public.ingresos_stock_lotes for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.perfiles_usuario p
    where p.id = auth.uid()
      and (
        (
          p.rol = 'POSTA_MANAGER'::public.role_user
          and p.posta_id = ingresos_stock_lotes.posta_id
        )
        or p.rol = 'ADMIN_GENERAL'::public.role_user
      )
  )
);

-- Backfill: agrupa líneas históricas registradas en el mismo minuto con mismos metadatos.
with grupos as (
  select
    gen_random_uuid() as lote_id,
    i.posta_id,
    i.fecha,
    i.tipo_origen,
    i.referencia,
    i.observacion,
    i.created_by,
    min(i.created_at) as created_at,
    array_agg(i.id order by i.created_at, i.id) as linea_ids
  from public.ingresos_stock_mes i
  where i.lote_id is null
  group by
    i.posta_id,
    i.fecha,
    i.tipo_origen,
    i.referencia,
    i.observacion,
    i.created_by,
    date_trunc('minute', i.created_at)
),
insertados as (
  insert into public.ingresos_stock_lotes (
    id,
    posta_id,
    fecha,
    tipo_origen,
    referencia,
    observacion,
    created_by,
    created_at
  )
  select
    g.lote_id,
    g.posta_id,
    g.fecha,
    g.tipo_origen,
    g.referencia,
    g.observacion,
    g.created_by,
    g.created_at
  from grupos g
  returning id
)
update public.ingresos_stock_mes i
set lote_id = g.lote_id
from grupos g
where i.id = any (g.linea_ids)
  and i.lote_id is null;
