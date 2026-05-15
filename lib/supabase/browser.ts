import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Cliente para componentes marcados con "use client" (solo claves públicas). */
export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
