-- Idempotencia de sincronización offline (PWA / IndexedDB).
alter table public.movimientos_diarios_consumo
  add column if not exists client_sync_id uuid;

create unique index if not exists idx_consumo_client_sync_id
  on public.movimientos_diarios_consumo (client_sync_id)
  where client_sync_id is not null;

comment on column public.movimientos_diarios_consumo.client_sync_id is
  'UUID generado en el cliente; evita duplicados al reintentar sync offline.';
