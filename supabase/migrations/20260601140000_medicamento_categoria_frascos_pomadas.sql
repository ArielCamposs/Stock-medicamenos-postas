-- Separa la categoría unificada: nuevos valores del enum (migración de datos en el archivo siguiente).

alter type public.medicamento_categoria add value if not exists 'FRASCOS';
alter type public.medicamento_categoria add value if not exists 'POMADAS_SUPOSITORIOS';
