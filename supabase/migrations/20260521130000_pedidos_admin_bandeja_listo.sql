-- Marca opcional en bandeja de administración (revisado / no prioritario).
alter table public.pedidos_mensuales
  add column if not exists admin_bandeja_listo_en timestamptz,
  add column if not exists admin_bandeja_listo_por uuid references auth.users (id) on delete set null;

comment on column public.pedidos_mensuales.admin_bandeja_listo_en is
  'Administración marca la fila como atendida en la bandeja (no cambia el estado del pedido).';
