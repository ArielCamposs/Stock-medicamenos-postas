/*
  Stock ideal de insumos definido en catálogo (administración).
  La encargada de posta solo registra stock actual al pedir.
*/

alter table public.insumos
  add column if not exists stock_objetivo int not null default 0
    constraint ck_insumo_stock_obj_nonneg check (stock_objetivo >= 0);

comment on column public.insumos.stock_objetivo is
  'Cantidad que cada posta debe mantener. Lo define administración al crear/editar el insumo.';
