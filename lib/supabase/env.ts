/** Si no hay configuración completa el middleware ignora refresco pero la app debe definir estas variables. */
export function hasSupabasePublicEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return Boolean(url && key);
}

/** Lee la URL del proyecto Supabase publicada en cliente. */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Define NEXT_PUBLIC_SUPABASE_URL en .env.local (pestaña API del dashboard de Supabase)."
    );
  }

  return url;
}

/** Clave anónima / publicada (solo operaciones permitidas por RLS). No uses service_role aquí. */
export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!key) {
    throw new Error(
      "Define NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local (o NEXT_PUBLIC_SUPABASE_ANON_KEY en proyectos antiguos)."
    );
  }

  return key;
}
