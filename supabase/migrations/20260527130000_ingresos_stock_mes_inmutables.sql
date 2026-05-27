-- Los ingresos registrados no se pueden modificar ni anular (política de inventario).

drop policy if exists ing_update on public.ingresos_stock_mes;
