import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase/env";

export function hasSupabaseServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Cliente con service role (solo servidor). Nunca importar en componentes cliente. */
export function createServiceSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Define SUPABASE_SERVICE_ROLE_KEY en .env.local para crear usuarios desde administración."
    );
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
