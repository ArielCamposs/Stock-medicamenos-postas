"use server";

import { revalidatePath } from "next/cache";

import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import type { RolUsuarioDb } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createServiceSupabaseClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase/service";

export type AdminUsuarioActionState = {
  error?: string | null;
  ok?: boolean;
  success?: string | null;
};

const ROLES_DESDE_APP: RolUsuarioDb[] = ["BODEGA_FARMACIA", "POSTA_MANAGER"];

function parseRol(raw: FormDataEntryValue | null): RolUsuarioDb | null {
  const s = raw?.toString().trim();
  if (s === "BODEGA_FARMACIA" || s === "POSTA_MANAGER") return s;
  return null;
}

function parseActivo(raw: FormDataEntryValue | null): boolean {
  return raw?.toString() === "true";
}

function validarDatosUsuario(input: {
  email?: string;
  password?: string;
  rol: RolUsuarioDb | null;
  postaId: string | null;
  passwordOpcional?: boolean;
}): string | null {
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Correo no válido.";
    }
  }

  if (input.password !== undefined && input.password !== "") {
    if (input.password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres.";
    }
  } else if (!input.passwordOpcional && input.password !== undefined) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }

  if (!input.rol) {
    return "Selecciona un rol válido.";
  }
  if (input.rol === "POSTA_MANAGER" && !input.postaId) {
    return "El encargado de posta debe tener una sede asignada.";
  }
  if (input.rol === "BODEGA_FARMACIA" && input.postaId) {
    return "Bodega farmacia no debe tener posta asignada.";
  }
  return null;
}

function errorSiNoServiceRole(): AdminUsuarioActionState | null {
  if (!hasSupabaseServiceRoleKey()) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Agrégala en variables de entorno y reinicia la app.",
    };
  }
  return null;
}

type PerfilObjetivo = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: RolUsuarioDb;
  posta_id: string | null;
  activo: boolean;
};

async function cargarPerfilObjetivo(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  usuarioId: string
): Promise<{ error: string } | { perfil: PerfilObjetivo }> {
  const { data, error } = await supabase
    .from("perfiles_usuario")
    .select("id, email, nombre, rol, posta_id, activo")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data || typeof data.id !== "string") {
    return { error: "El usuario no existe." };
  }

  const rol = data.rol;
  if (
    rol !== "BODEGA_FARMACIA" &&
    rol !== "POSTA_MANAGER" &&
    rol !== "ADMIN_GENERAL" &&
    rol !== "READ_ONLY"
  ) {
    return { error: "Perfil no reconocido." };
  }

  return {
    perfil: {
      id: data.id,
      email: typeof data.email === "string" ? data.email : null,
      nombre: typeof data.nombre === "string" ? data.nombre : null,
      rol,
      posta_id: typeof data.posta_id === "string" ? data.posta_id : null,
      activo: data.activo !== false,
    },
  };
}

function errorSiPerfilProtegido(
  actorId: string,
  perfil: { id: string; rol: RolUsuarioDb }
): string | null {
  if (perfil.id === actorId) {
    return "No puedes modificar ni eliminar tu propia cuenta desde aquí.";
  }
  if (perfil.rol === "ADMIN_GENERAL" || perfil.rol === "READ_ONLY") {
    return "Los usuarios de administración general y supervisión solo se gestionan en Supabase.";
  }
  if (!ROLES_DESDE_APP.includes(perfil.rol)) {
    return "Este perfil no se puede gestionar desde la app.";
  }
  return null;
}

export async function crearUsuarioPerfilAction(
  _prev: AdminUsuarioActionState,
  formData: FormData
): Promise<AdminUsuarioActionState> {
  const { profile } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Solo administración general puede crear usuarios." };
  }

  const bloqueo = errorSiNoServiceRole();
  if (bloqueo) return bloqueo;

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const nombre = formData.get("nombre")?.toString().trim() || null;
  const password = formData.get("password")?.toString() ?? "";
  const rol = parseRol(formData.get("rol"));
  const postaIdRaw = formData.get("posta_id")?.toString().trim() ?? "";
  const postaId = postaIdRaw === "" ? null : postaIdRaw;

  const validacion = validarDatosUsuario({ email, password, rol, postaId });
  if (validacion) return { error: validacion };

  const service = createServiceSupabaseClient();
  const { data: created, error: authErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr || !created.user?.id) {
    const msg = authErr?.message ?? "No se pudo crear la cuenta.";
    if (msg.toLowerCase().includes("already")) {
      return { error: "Ya existe una cuenta con ese correo en Auth." };
    }
    return { error: msg };
  }

  const userId = created.user.id;
  const supabase = await createServerSupabaseClient();
  const { error: perfErr } = await supabase.from("perfiles_usuario").insert({
    id: userId,
    email,
    nombre,
    rol,
    posta_id: rol === "POSTA_MANAGER" ? postaId : null,
    activo: true,
  });

  if (perfErr) {
    await service.auth.admin.deleteUser(userId);
    return { error: perfErr.message };
  }

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    success:
      rol === "BODEGA_FARMACIA"
        ? `Usuario de bodega creado (${email}). Ya puede ingresar en /bodega.`
        : `Encargado de posta creado (${email}).`,
  };
}

export async function actualizarUsuarioPerfilAction(
  _prev: AdminUsuarioActionState,
  formData: FormData
): Promise<AdminUsuarioActionState> {
  const { profile, user } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Solo administración general puede editar usuarios." };
  }

  const bloqueo = errorSiNoServiceRole();
  if (bloqueo) return bloqueo;

  const usuarioId = formData.get("usuario_id")?.toString().trim();
  if (!usuarioId) return { error: "ID de usuario no válido." };

  const supabase = await createServerSupabaseClient();
  const cargado = await cargarPerfilObjetivo(supabase, usuarioId);
  if (!("perfil" in cargado)) {
    return { error: cargado.error };
  }
  const objetivo = cargado.perfil;

  const protegido = errorSiPerfilProtegido(user.id, objetivo);
  if (protegido) return { error: protegido };

  const nombre = formData.get("nombre")?.toString().trim() || null;
  const rol = parseRol(formData.get("rol"));
  const postaIdRaw = formData.get("posta_id")?.toString().trim() ?? "";
  const postaId = postaIdRaw === "" ? null : postaIdRaw;
  const activo = parseActivo(formData.get("activo"));
  const passwordNueva = formData.get("password_nueva")?.toString() ?? "";

  const validacion = validarDatosUsuario({
    rol,
    postaId,
    password: passwordNueva,
    passwordOpcional: true,
  });
  if (validacion) return { error: validacion };

  const service = createServiceSupabaseClient();

  if (passwordNueva.trim().length > 0) {
    const { error: passErr } = await service.auth.admin.updateUserById(usuarioId, {
      password: passwordNueva,
    });
    if (passErr) return { error: passErr.message };
  }

  const { error: perfErr } = await supabase
    .from("perfiles_usuario")
    .update({
      nombre,
      rol,
      posta_id: rol === "POSTA_MANAGER" ? postaId : null,
      activo,
    })
    .eq("id", usuarioId);

  if (perfErr) return { error: perfErr.message };

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    success: activo
      ? `Usuario ${objetivo.email ?? objetivo.id} actualizado.`
      : `Usuario ${objetivo.email ?? objetivo.id} desactivado.`,
  };
}

export async function eliminarUsuarioPerfilAction(
  _prev: AdminUsuarioActionState,
  formData: FormData
): Promise<AdminUsuarioActionState> {
  const { profile, user } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Solo administración general puede eliminar usuarios." };
  }

  const bloqueo = errorSiNoServiceRole();
  if (bloqueo) return bloqueo;

  const usuarioId = formData.get("usuario_id")?.toString().trim();
  if (!usuarioId) return { error: "ID de usuario no válido." };
  if (formData.get("confirmar") !== "si") {
    return { error: "Debes confirmar la eliminación." };
  }

  const supabase = await createServerSupabaseClient();
  const cargado = await cargarPerfilObjetivo(supabase, usuarioId);
  if (!("perfil" in cargado)) {
    return { error: cargado.error };
  }
  const objetivo = cargado.perfil;

  const protegido = errorSiPerfilProtegido(user.id, objetivo);
  if (protegido) return { error: protegido };

  const service = createServiceSupabaseClient();
  const { error: deleteErr } = await service.auth.admin.deleteUser(usuarioId);

  if (deleteErr) {
    const msg = deleteErr.message ?? "";
    if (
      msg.includes("violates") ||
      msg.includes("constraint") ||
      msg.includes("foreign key")
    ) {
      return {
        error: `No se puede eliminar «${objetivo.email ?? objetivo.id}» porque tiene pedidos u otros registros en el sistema. Desactívalo en Editar en su lugar.`,
      };
    }
    return { error: msg || "No se pudo eliminar la cuenta." };
  }

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    success: `Cuenta ${objetivo.email ?? objetivo.id} eliminada.`,
  };
}
