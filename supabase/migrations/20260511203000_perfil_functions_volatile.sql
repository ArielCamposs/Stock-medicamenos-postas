/*
  PostgreSQL: SET LOCAL solo está permitido en funciones VOLATILE.
  Si quedaron como STABLE, mi_perfil_app() falla con:
  "SET is not allowed in a non-volatile function"
*/

create or replace function public.auth_is_admin_general()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'ADMIN_GENERAL'::public.role_user
  );
end;
$$;

comment on function public.auth_is_admin_general() is
  'Comprueba ADMIN_GENERAL sin reentrada RLS.';

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
