-- Categorías fijas del catálogo (listados, tablas de stock, descuentos, pedidos).

create type public.medicamento_categoria as enum (
  'COMPRIMIDOS',
  'INYECTABLES',
  'FRASCOS_POMADAS_SUPOSITORIOS',
  'PROGRAMA_MUJER',
  'CONTRA_RECETA',
  'OTROS'
);

comment on type public.medicamento_categoria is
  'Grupo de presentación / programa para ordenar y agrupar medicamentos en la interfaz.';

alter table public.medicamentos
  add column categoria public.medicamento_categoria not null default 'OTROS';

comment on column public.medicamentos.categoria is
  'Agrupación para tablas y formularios (comprimidos, inyectables, etc.).';

create index idx_medicamentos_categoria_activo_nombre
  on public.medicamentos (categoria, activo, nombre);
