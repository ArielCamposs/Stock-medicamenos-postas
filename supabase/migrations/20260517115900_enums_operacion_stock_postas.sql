-- Valores de enum usados por las mejoras operativas.
-- Van en una migración previa para que Postgres pueda usarlos en políticas posteriores.

alter type public.estado_pedido add value if not exists 'OBSERVADO';
alter type public.estado_pedido add value if not exists 'RECHAZADO';
alter type public.estado_pedido add value if not exists 'DESPACHADO';
alter type public.estado_pedido add value if not exists 'RECIBIDO';
