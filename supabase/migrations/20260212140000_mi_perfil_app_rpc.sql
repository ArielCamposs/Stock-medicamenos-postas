/*
  Lectura de perfil propio vía RPC con SECURITY DEFINER.
  SET LOCAL row_security = off evita recursión RLS al leer perfiles_usuario.
*/

create or replace function public.mi_perfil_app()
returns setof public.perfiles_usuario
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return query
  select *
  from public.perfiles_usuario
  where id = auth.uid()
  limit 1;
end;
$$;

comment on function public.mi_perfil_app() is
  'Perfil del usuario actual; lectura sin reentrada RLS.';

revoke all on function public.mi_perfil_app() from public;
grant execute on function public.mi_perfil_app() to authenticated;
