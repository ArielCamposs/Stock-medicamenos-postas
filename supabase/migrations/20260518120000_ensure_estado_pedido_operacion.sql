-- Estados extra del flujo de pedidos (admin / despacho / recepción).
-- Idempotente: no falla si ya se aplicó 20260517115900_enums_operacion_stock_postas.sql.
alter type public.estado_pedido add value if not exists 'OBSERVADO';
alter type public.estado_pedido add value if not exists 'RECHAZADO';
alter type public.estado_pedido add value if not exists 'DESPACHADO';
alter type public.estado_pedido add value if not exists 'RECIBIDO';
