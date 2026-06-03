import { redirect } from "next/navigation";

import { isNetworkError } from "@/lib/auth/network-error";
import { readPerfilOfflineCookie } from "@/lib/auth/perfil-offline-cookie.server";
import type { PerfilUsuarioRow, RolUsuarioDb } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeRol(raw: unknown): RolUsuarioDb | null {
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (
    s === "ADMIN_GENERAL" ||
    s === "BODEGA_FARMACIA" ||
    s === "POSTA_MANAGER" ||
    s === "READ_ONLY"
  ) {
    return s;
  }
  return null;
}

function normalizeBoolean(raw: unknown): boolean | null {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (raw === "t" || raw === true || raw === 1 || raw === "true") {
    return true;
  }
  if (raw === "f" || raw === false || raw === 0 || raw === "false") {
    return false;
  }
  return null;
}

function mapPerfilRow(row: Record<string, unknown>): PerfilUsuarioRow | null {
  const rol = normalizeRol(row.rol);
  const activo = normalizeBoolean(row.activo);

  if (typeof row.id !== "string" || activo === null || !rol) {
    return null;
  }

  return {
    id: row.id,
    email:
      row.email === null || typeof row.email === "string" ? row.email : null,
    nombre:
      row.nombre === null || typeof row.nombre === "string"
        ? row.nombre
        : null,
    rol,
    posta_id:
      row.posta_id === null || typeof row.posta_id === "string"
        ? row.posta_id
        : null,
    activo,
  };
}

/** Contexto de sesión; si hay usuario pero `profile` es null, revisa `perfilInactivo`. */
export type SessionContext =
  | { user: null; profile: null }
  | { user: { id: string }; profile: PerfilUsuarioRow }
  | {
      user: { id: string };
      profile: null;
      /** Hay fila pero `activo = false`. */
      perfilInactivo?: boolean;
    };

export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user: validatedUser },
    error: userError,
  } = await supabase.auth.getUser();

  let user = validatedUser ?? null;

  if (!user?.id && userError && isNetworkError(userError)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }

  if (!user?.id) {
    return { user: null, profile: null };
  }

  const rpcResult = await supabase.rpc("mi_perfil_app");
  let rawRow: Record<string, unknown> | null = null;

  if (!rpcResult.error && rpcResult.data !== null && rpcResult.data !== undefined) {
    const payload = rpcResult.data as unknown;
    if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === "object") {
      rawRow = payload[0] as Record<string, unknown>;
    } else if (
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload)
    ) {
      rawRow = payload as Record<string, unknown>;
    }
  }

  if (!rawRow) {
    if (rpcResult.error && isNetworkError(rpcResult.error)) {
      const cached = await readPerfilOfflineCookie();
      if (cached && cached.id === user.id && cached.activo) {
        return { user, profile: cached };
      }
    }
    if (rpcResult.error && process.env.NODE_ENV === "development") {
      console.error(
        "[mi_perfil_app] ejecuta en Supabase los SQL de migración: fix_perfiles_rls_recursion + mi_perfil_app_rpc + perfiles_functions_disable_rls_inside:",
        rpcResult.error.message
      );
    }
    return { user, profile: null };
  }

  const profile = mapPerfilRow(rawRow);
  if (!profile) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[perfiles_usuario] fila ilegible para la app:", rawRow);
    }
    return { user, profile: null };
  }

  if (!profile.activo) {
    return { user, profile: null, perfilInactivo: true };
  }

  return { user, profile };
}

/** Exige usuario autenticado y perfil activo en `perfiles_usuario`. */
export async function requirePerfilUsuario(
  mensajeSinPerfilSearchParam = "sin_perfil"
) {
  const ctx = await getSessionContext();
  if (!ctx.user) {
    redirect("/login");
  }

  if (!ctx.profile) {
    if ("perfilInactivo" in ctx && ctx.perfilInactivo) {
      redirect("/login?error=perfil_inactivo");
    }
    redirect(`/login?error=${mensajeSinPerfilSearchParam}`);
  }

  return ctx;
}

export function tieneAccesoGlobalAdmin(profile: PerfilUsuarioRow) {
  return profile.rol === "ADMIN_GENERAL" || profile.rol === "READ_ONLY";
}

/** Solo este rol puede crear/editar catálogo y postas en la UI admin. */
export function esAdminGeneral(profile: PerfilUsuarioRow) {
  return profile.rol === "ADMIN_GENERAL";
}

export function esBodegaFarmacia(profile: PerfilUsuarioRow) {
  return profile.rol === "BODEGA_FARMACIA";
}

/** Perfil central de bodega (sin posta asignada). */
export function perfilBodegaConsistente(profile: PerfilUsuarioRow): boolean {
  return profile.rol === "BODEGA_FARMACIA" && profile.posta_id === null;
}

export function puedeVerPosta(profile: PerfilUsuarioRow, postaId: string) {
  if (tieneAccesoGlobalAdmin(profile)) {
    return true;
  }
  return profile.rol === "POSTA_MANAGER" && profile.posta_id === postaId;
}

/**
 * Descuento diario y pedidos del mes: solo el encargado de esa posta.
 * La administración general puede ver todo y cargar ingresos/AVIS, pero no descuentos ni pedidos desde la vista de posta.
 */
export function puedeRegistrarOperacionesPosta(
  profile: PerfilUsuarioRow,
  postaId: string
): boolean {
  return (
    profile.rol === "POSTA_MANAGER" &&
    profile.posta_id !== null &&
    profile.posta_id === postaId
  );
}

/** Pedido mensual: queda reservado al encargado responsable de la posta. */
export function puedeGestionarPedidoMensualPosta(
  profile: PerfilUsuarioRow,
  postaId: string
): boolean {
  return (
    profile.rol === "POSTA_MANAGER" &&
    profile.posta_id !== null &&
    profile.posta_id === postaId
  );
}

/**
 * Ingresos de stock y declaración mensual AVIS: encargado de la posta o administración general.
 * No aplica a descuentos diarios (`puedeRegistrarOperacionesPosta`).
 */
export function puedeRegistrarStockYAvisPosta(
  profile: PerfilUsuarioRow,
  postaId: string
): boolean {
  if (puedeRegistrarOperacionesPosta(profile, postaId)) {
    return true;
  }
  return profile.rol === "ADMIN_GENERAL" && puedeVerPosta(profile, postaId);
}

/** Aviso «solo lectura» en cabecera de posta: solo perfiles sin escritura en ninguna parte. */
export function esSoloSupervisionPosta(profile: PerfilUsuarioRow): boolean {
  return profile.rol === "READ_ONLY";
}
