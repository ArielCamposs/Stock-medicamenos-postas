-- Medicamentos que aún usan la categoría enum CONTRA_RECETA como “tipo de pedido”:
-- activar el flag es_contra_receta para que aparezcan en el pedido separado sin mezclarse en Otros.

update public.medicamentos
set es_contra_receta = true
where categoria = 'CONTRA_RECETA'::public.medicamento_categoria
  and es_contra_receta = false;
