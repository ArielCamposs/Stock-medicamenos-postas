/*
  Si el SQL Editor falla con "unsafe use of new value BODEGA_FARMACIA",
  ejecuta en DOS consultas separadas (Run en cada bloque, no todo junto).

  --- PASO 1 (Run y esperar éxito) ---
*/
alter type public.role_user add value if not exists 'BODEGA_FARMACIA';

/*
  --- PASO 2 (nueva consulta / nuevo Run) ---
  Copia el contenido de:
  supabase/migrations/20260602160100_role_bodega_farmacia_policies.sql
*/
