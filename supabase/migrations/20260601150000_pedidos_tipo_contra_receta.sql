-- Agrega columna `tipo` a pedidos_mensuales para separar pedido general de contra receta.

alter table public.pedidos_mensuales
  add column if not exists tipo text not null default 'GENERAL'
    constraint ck_pedido_tipo check (tipo in ('GENERAL', 'CONTRA_RECETA'));

-- Quitar la restricción única anterior (posta, año, mes).
alter table public.pedidos_mensuales
  drop constraint if exists pedidos_mensuales_posta_id_anio_mes_key;

-- Nueva restricción: un pedido de cada tipo por posta y mes.
alter table public.pedidos_mensuales
  add constraint pedidos_mensuales_posta_id_anio_mes_tipo_key
    unique (posta_id, anio, mes, tipo);

comment on column public.pedidos_mensuales.tipo is
  'GENERAL: todos los medicamentos salvo contra receta. CONTRA_RECETA: solo medicamentos con entrega contra receta.';
