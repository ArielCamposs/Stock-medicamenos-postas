-- Reclasifica medicamentos de la categoría antigua unificada hacia Frascos.

update public.medicamentos
set categoria = 'FRASCOS'::public.medicamento_categoria
where categoria = 'FRASCOS_POMADAS_SUPOSITORIOS'::public.medicamento_categoria;
