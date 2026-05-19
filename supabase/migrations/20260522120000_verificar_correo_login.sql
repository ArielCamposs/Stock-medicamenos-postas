-- Pre-login: validar correo en Auth + perfil antes de intentar contraseña.

create or replace function public.verificar_correo_login(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_perfil public.perfiles_usuario%rowtype;
begin
  v_norm := lower(trim(coalesce(p_email, '')));
  if v_norm = '' then
    return 'correo_invalido';
  end if;

  if not exists (
    select 1
    from auth.users u
    where lower(trim(coalesce(u.email::text, ''))) = v_norm
  ) then
    return 'no_encontrado';
  end if;

  select *
  into v_perfil
  from public.perfiles_usuario pu
  where lower(pu.email::text) = v_norm
  limit 1;

  if not found then
    return 'sin_perfil';
  end if;

  if not v_perfil.activo then
    return 'inactivo';
  end if;

  if v_perfil.rol = 'POSTA_MANAGER'::public.role_user and v_perfil.posta_id is null then
    return 'sin_posta';
  end if;

  if v_perfil.rol = 'ADMIN_GENERAL'::public.role_user and v_perfil.posta_id is not null then
    return 'perfil_inconsistente';
  end if;

  return 'ok';
end;
$$;

comment on function public.verificar_correo_login(text) is
  'Login: comprueba que el correo exista en Auth y tenga perfil usable (sin revelar contraseña).';

revoke all on function public.verificar_correo_login(text) from public;
grant execute on function public.verificar_correo_login(text) to anon, authenticated;
