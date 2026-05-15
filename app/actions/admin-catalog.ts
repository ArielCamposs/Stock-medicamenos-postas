"use server";

import { revalidatePath } from "next/cache";

import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import { normalizarMedicamentoCategoria } from "@/lib/domain/medicamento-categoria";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CatalogActionState = {
  error?: string | null;
  success?: string | null;
  values?: {
    nombre?: string;
    codigo_interno?: string;
    codigo_avis?: string;
    unidad_medida?: string;
    categoria?: string;
    stock_recomendado_default?: number;
    stock_critico_default?: number;
    activo?: boolean;
  };
};

function parseOptionalText(raw: FormDataEntryValue | null) {
  const s = raw?.toString().trim();
  return s === "" ? null : s ?? null;
}

export async function createPostaAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  const { profile } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Solo un usuario con rol de administración general puede crear postas." };
  }

  const nombre = formData.get("nombre")?.toString().trim();
  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }

  const codigo = parseOptionalText(formData.get("codigo"));
  const activa = formData.get("activa") === "on";

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("postas").insert({
    nombre,
    codigo,
    activa,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/postas");
  revalidatePath("/admin");
  return {};
}

export async function updatePostaAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  const { profile } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Sin permiso para editar." };
  }

  const id = formData.get("id")?.toString().trim();
  if (!id) {
    return { error: "Falta el identificador de la posta." };
  }

  const nombre = formData.get("nombre")?.toString().trim();
  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }

  const codigo = parseOptionalText(formData.get("codigo"));
  const activa = formData.get("activa") === "on";

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("postas")
    .update({ nombre, codigo, activa })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/postas");
  revalidatePath("/admin");
  return {};
}

export async function createMedicamentoAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  const { profile } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Solo un usuario con rol de administración general puede crear medicamentos." };
  }

  const nombre = formData.get("nombre")?.toString().trim();
  const codigo_interno = formData.get("codigo_interno")?.toString().trim();
  const unidad_medida = formData.get("unidad_medida")?.toString().trim();

  const values = {
    nombre,
    codigo_interno,
    unidad_medida,
  };

  if (!nombre || !codigo_interno || !unidad_medida) {
    return {
      error: "Nombre, código interno y unidad de medida son obligatorios.",
      values,
    };
  }

  const codigo_avis = parseOptionalText(formData.get("codigo_avis"));

  const stock_rec_raw = formData.get("stock_recomendado_default")?.toString();
  const stock_crit_raw = formData.get("stock_critico_default")?.toString();

  const stock_recomendado_default = Number.parseInt(stock_rec_raw ?? "", 10);
  const stock_critico_default = Number.parseInt(stock_crit_raw ?? "", 10);

  const activo = formData.get("activo") === "on";
  const categoria = normalizarMedicamentoCategoria(
    formData.get("categoria")?.toString()
  );

  const valuesConResto = {
    ...values,
    codigo_avis: codigo_avis ?? undefined,
    stock_recomendado_default,
    stock_critico_default,
    categoria,
    activo,
  };

  if (
    Number.isNaN(stock_recomendado_default) ||
    Number.isNaN(stock_critico_default) ||
    stock_recomendado_default < 0 ||
    stock_critico_default < 0
  ) {
    return {
      error:
        "Los stocks recomendado y crítico deben ser números enteros mayores o iguales a 0.",
      values: valuesConResto,
    };
  }

  if (stock_critico_default > stock_recomendado_default) {
    return {
      error: "El stock crítico no puede ser mayor que el stock recomendado.",
      values: valuesConResto,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("medicamentos").insert({
    nombre,
    codigo_interno,
    codigo_avis,
    unidad_medida,
    categoria,
    stock_recomendado_default,
    stock_critico_default,
    activo,
  });

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("codigo_interno")) {
        return { 
          error: `Ya existe un medicamento registrado con el código interno "${codigo_interno}". Revisa el catálogo antes de agregarlo.`,
          values: valuesConResto,
        };
      }
      return { 
        error: "Ya existe un registro con esos datos únicos.",
        values: valuesConResto,
      };
    }
    return { error: error.message, values: valuesConResto };
  }

  revalidatePath("/admin/medicamentos");
  revalidatePath("/admin");
  return {};
}

export async function updateMedicamentoAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  const { profile } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Sin permiso para editar." };
  }

  const id = formData.get("id")?.toString().trim();
  if (!id) {
    return { error: "Falta el identificador del medicamento." };
  }

  const nombre = formData.get("nombre")?.toString().trim();
  const codigo_interno = formData.get("codigo_interno")?.toString().trim();
  const unidad_medida = formData.get("unidad_medida")?.toString().trim();

  if (!nombre || !codigo_interno || !unidad_medida) {
    return {
      error: "Nombre, código interno y unidad de medida son obligatorios.",
    };
  }

  const codigo_avis = parseOptionalText(formData.get("codigo_avis"));

  const stock_rec_raw = formData.get("stock_recomendado_default")?.toString();
  const stock_crit_raw = formData.get("stock_critico_default")?.toString();

  const stock_recomendado_default = Number.parseInt(stock_rec_raw ?? "", 10);
  const stock_critico_default = Number.parseInt(stock_crit_raw ?? "", 10);

  if (
    Number.isNaN(stock_recomendado_default) ||
    Number.isNaN(stock_critico_default) ||
    stock_recomendado_default < 0 ||
    stock_critico_default < 0
  ) {
    return {
      error:
        "Los stocks recomendado y crítico deben ser números enteros mayores o iguales a 0.",
    };
  }

  if (stock_critico_default > stock_recomendado_default) {
    return {
      error: "El stock crítico no puede ser mayor que el stock recomendado.",
    };
  }

  const activo = formData.get("activo") === "on";
  const categoria = normalizarMedicamentoCategoria(
    formData.get("categoria")?.toString()
  );

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("medicamentos")
    .update({
      nombre,
      codigo_interno,
      codigo_avis,
      unidad_medida,
      categoria,
      stock_recomendado_default,
      stock_critico_default,
      activo,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/medicamentos");
  revalidatePath(`/admin/medicamentos/${id}/edit`);
  revalidatePath("/admin");
  return {
    success: "Los cambios del medicamento se guardaron correctamente.",
  };
}
