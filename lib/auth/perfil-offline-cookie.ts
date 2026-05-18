import type { PerfilUsuarioRow } from "@/lib/auth/types";

export const PERFIL_OFFLINE_COOKIE = "desam_perfil_cache";

const MAX_AGE_SEC = 7 * 24 * 60 * 60;

export function serializePerfilOfflineCookie(profile: PerfilUsuarioRow): string {
  return encodeURIComponent(
    JSON.stringify({
      id: profile.id,
      email: profile.email,
      nombre: profile.nombre,
      rol: profile.rol,
      posta_id: profile.posta_id,
      activo: profile.activo,
    })
  );
}

export function perfilOfflineCookieHeader(profile: PerfilUsuarioRow): string {
  return `${PERFIL_OFFLINE_COOKIE}=${serializePerfilOfflineCookie(profile)}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function parsePerfilOfflineCookieValue(raw: string): PerfilUsuarioRow | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (typeof parsed.id !== "string") return null;
    const rol = parsed.rol;
    if (
      rol !== "ADMIN_GENERAL" &&
      rol !== "POSTA_MANAGER" &&
      rol !== "READ_ONLY"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      email:
        parsed.email === null || typeof parsed.email === "string"
          ? parsed.email
          : null,
      nombre:
        parsed.nombre === null || typeof parsed.nombre === "string"
          ? parsed.nombre
          : null,
      rol,
      posta_id:
        parsed.posta_id === null || typeof parsed.posta_id === "string"
          ? parsed.posta_id
          : null,
      activo: parsed.activo !== false,
    };
  } catch {
    return null;
  }
}
