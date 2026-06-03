import type { RolUsuarioDb } from "@/lib/auth/types";

export const ETIQUETA_ROL_USUARIO: Record<RolUsuarioDb, string> = {
  ADMIN_GENERAL: "Administración general",
  BODEGA_FARMACIA: "Bodega farmacia",
  POSTA_MANAGER: "Encargado/a de posta",
  READ_ONLY: "Supervisión (solo lectura)",
};

export function etiquetaRolUsuario(rol: RolUsuarioDb | string): string {
  const r = rol as RolUsuarioDb;
  return ETIQUETA_ROL_USUARIO[r] ?? rol.replaceAll("_", " ");
}
