-- Nombres únicos en catálogo (insensible a mayúsculas y espacios extra).
-- Renombra duplicados existentes antes de crear el índice (conserva el más antiguo tal cual).

drop index if exists public.idx_medicamentos_nombre_norm_unique;
drop index if exists public.idx_insumos_nombre_norm_unique;

-- Medicamentos: el primero por fecha queda igual; el resto lleva el código interno entre paréntesis.
with medicamentos_norm as (
  select
    id,
    nombre,
    codigo_interno,
    row_number() over (
      partition by lower(trim(regexp_replace(nombre, '\s+', ' ', 'g')))
      order by created_at asc, id asc
    ) as rn
  from public.medicamentos
)
update public.medicamentos m
set nombre = trim(mn.nombre) || ' (' || mn.codigo_interno || ')'
from medicamentos_norm mn
where m.id = mn.id
  and mn.rn > 1
  and trim(m.nombre) not like '% (' || mn.codigo_interno || ')';

-- Insumos: el primero queda igual; duplicados llevan un sufijo corto del id.
with insumos_norm as (
  select
    id,
    nombre,
    row_number() over (
      partition by lower(trim(regexp_replace(nombre, '\s+', ' ', 'g')))
      order by created_at asc, id asc
    ) as rn
  from public.insumos
)
update public.insumos i
set nombre = trim(inm.nombre) || ' (ref ' || left(inm.id::text, 8) || ')'
from insumos_norm inm
where i.id = inm.id
  and inm.rn > 1
  and trim(i.nombre) not like '% (ref ' || left(inm.id::text, 8) || ')';

create unique index idx_medicamentos_nombre_norm_unique
  on public.medicamentos ((
    lower(trim(regexp_replace(nombre, '\s+', ' ', 'g')))
  ));

create unique index idx_insumos_nombre_norm_unique
  on public.insumos ((
    lower(trim(regexp_replace(nombre, '\s+', ' ', 'g')))
  ));
