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

function parseRol(raw: FormDataEntryValue | null): RolUsuarioDb | null {
  const s = raw?.toString().trim();
  if (s === "BODEGA_FARMACIA" || s === "POSTA_MANAGER") return s;
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

  if (!hasSupabaseServiceRoleKey()) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Agrégala en .env.local (Supabase → Settings → API → service_role) y reinicia la app.",
    };
  }

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const nombre = formData.get("nombre")?.toString().trim() || null;
  const password = formData.get("password")?.toString() ?? "";
  const rol = parseRol(formData.get("rol"));
  const postaIdRaw = formData.get("posta_id")?.toString().trim() ?? "";
  const postaId = postaIdRaw === "" ? null : postaIdRaw;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Correo no válido." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!rol) {
    return { error: "Selecciona un rol válido." };
  }
  if (rol === "POSTA_MANAGER" && !postaId) {
    return { error: "El encargado de posta debe tener una sede asignada." };
  }
  if (rol === "BODEGA_FARMACIA" && postaId) {
    return { error: "Bodega farmacia no debe tener posta asignada." };
  }

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
