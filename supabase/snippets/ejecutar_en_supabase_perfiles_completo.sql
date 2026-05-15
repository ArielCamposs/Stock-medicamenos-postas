/*
  PEGAR Y EJECUTAR UNA VEZ en Supabase → SQL (mismo proyecto que .env)
  Orden: políticas RLS sin recursión + funciones con row_security off dentro.
*/

-- === Desde 20260212160000_fix_perfiles_rls_recursion.sql ===
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

revoke all on function public.auth_is_admin_general() from public;
grant execute on function public.auth_is_admin_general() to authenticated;

drop policy if exists perf_select_own_or_admin on public.perfiles_usuario;
drop policy if exists perf_select_self on public.perfiles_usuario;
drop policy if exists perf_select_all_admin on public.perfiles_usuario;
drop policy if exists perf_insert_admin on public.perfiles_usuario;
drop policy if exists perf_update_own_or_admin on public.perfiles_usuario;
drop policy if exists perf_delete_admin on public.perfiles_usuario;

create policy perf_select_self on public.perfiles_usuario
for select to authenticated
using (id = auth.uid());

create policy perf_select_all_admin on public.perfiles_usuario
for select to authenticated
using (public.auth_is_admin_general());

create policy perf_insert_admin on public.perfiles_usuario
for insert to authenticated
with check (public.auth_is_admin_general());

create policy perf_update_own_or_admin on public.perfiles_usuario
for update to authenticated
using (id = auth.uid() or public.auth_is_admin_general())
with check (id = auth.uid() or public.auth_is_admin_general());

create policy perf_delete_admin on public.perfiles_usuario
for delete to authenticated
using (public.auth_is_admin_general());

-- === RPC perfil (20260212170000) ===
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

revoke all on function public.mi_perfil_app() from public;
grant execute on function public.mi_perfil_app() to authenticated;
