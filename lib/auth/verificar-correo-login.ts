import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Resultado de `public.verificar_correo_login`. */
export type CorreoLoginEstado =
  | "ok"
  | "correo_invalido"
  | "no_encontrado"
  | "sin_perfil"
  | "inactivo"
  | "sin_posta"
  | "perfil_inconsistente";

export async function verificarCorreoLogin(
  email: string
): Promise<{ estado: CorreoLoginEstado } | { error: string }> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("verificar_correo_login", {
    p_email: email.trim(),
  });

  if (error) {
    const msg = error.message ?? "Error al verificar el correo.";
    if (
      msg.includes("verificar_correo_login") ||
      msg.includes("Could not find the function")
    ) {
      return {
        error:
          "Falta aplicar la migración verificar_correo_login en Supabase. Avísale al administrador.",
      };
    }
    return { error: msg };
  }

  const estado = (typeof data === "string" ? data : "no_encontrado") as CorreoLoginEstado;
  return { estado };
}
