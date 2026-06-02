-- Confirmación de recepción por la posta (insumos despachados)
alter table public.pedidos_insumos
  add column if not exists despachado_en timestamptz,
  add column if not exists comentario_posta text;
