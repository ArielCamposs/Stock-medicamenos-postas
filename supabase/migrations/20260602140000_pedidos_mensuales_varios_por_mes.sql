-- Varios pedidos de medicamentos por mes (general y contra receta por separado).
-- Límite operativo: un envío por día calendario por tipo (validado en la app).

alter table public.pedidos_mensuales
  drop constraint if exists pedidos_mensuales_posta_id_anio_mes_tipo_key;

create index if not exists idx_pedidos_mensuales_posta_mes_tipo_creado
  on public.pedidos_mensuales (posta_id, anio, mes, tipo, fecha_creacion desc);

comment on column public.pedidos_mensuales.tipo is
  'GENERAL o CONTRA_RECETA. Puede haber varios pedidos del mismo tipo en un mes; la app limita a un envío por día calendario por tipo.';
