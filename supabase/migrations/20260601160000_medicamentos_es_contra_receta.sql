-- Agrega bandera `es_contra_receta` a medicamentos.
-- Esta columna es independiente de la categoría: cualquier medicamento de cualquier
-- categoría puede ser marcado como contra receta, y aparecerá tanto en el pedido
-- general como en el pedido separado de contra receta.

alter table public.medicamentos
  add column if not exists es_contra_receta boolean not null default false;

comment on column public.medicamentos.es_contra_receta is
  'Indica que el medicamento requiere receta para ser entregado. Se pide en un pedido separado además del pedido general.';
