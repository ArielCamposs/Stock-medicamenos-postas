"use server";

import { revalidatePath } from "next/cache";

import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import { siguienteCodigoInternoMedicamento } from "@/lib/domain/codigo-interno-medicamento";
import {
  normalizarMedicamentoCategoria,
  unidadMedidaDesdeCategoria,
} from "@/lib/domain/medicamento-categoria";
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

async function listarCodigosInternosMedicamentos(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string[]> {
  const { data, error } = await supabase.from("medicamentos").select("codigo_interno");
  if (error) throw new Error(error.message);
  const out: string[] = [];
  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === "object" && typeof row.codigo_interno === "string") {
        out.push(row.codigo_interno);
      }
    }
  }
  return out;
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
  const categoria = normalizarMedicamentoCategoria(
    formData.get("categoria")?.toString()
  );
  const unidad_medida = unidadMedidaDesdeCategoria(categoria);

  const supabase = await createServerSupabaseClient();
  let codigo_interno: string;
  try {
    codigo_interno = siguienteCodigoInternoMedicamento(
      await listarCodigosInternosMedicamentos(supabase)
    );
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "No se pudo calcular el código interno del medicamento.",
    };
  }

  const values = {
    nombre,
    codigo_interno,
    unidad_medida,
  };

  if (!nombre) {
    return {
      error: "El nombre es obligatorio.",
      values,
    };
  }

  const codigo_avis = parseOptionalText(formData.get("codigo_avis"));

  const stock_rec_raw = formData.get("stock_recomendado_default")?.toString();
  const stock_crit_raw = formData.get("stock_critico_default")?.toString();

  const stock_recomendado_default = Number.parseInt(stock_rec_raw ?? "", 10);
  const stock_critico_default = Number.parseInt(stock_crit_raw ?? "", 10);

  const activo = formData.get("activo") === "on";
  const es_contra_receta = formData.get("es_contra_receta") === "on";

  const valuesConResto = {
    ...values,
    codigo_avis: codigo_avis ?? undefined,
    stock_recomendado_default,
    stock_critico_default,
    categoria,
    activo,
    es_contra_receta,
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

  let codigoInsert = codigo_interno;
  for (let intento = 0; intento < 3; intento++) {
    const { error } = await supabase.from("medicamentos").insert({
      nombre,
      codigo_interno: codigoInsert,
      codigo_avis,
      unidad_medida,
      categoria,
      stock_recomendado_default,
      stock_critico_default,
      activo,
      es_contra_receta,
    });

    if (!error) {
      revalidatePath("/admin/medicamentos");
      revalidatePath("/admin");
      return {};
    }

    if (error.code === "23505" && error.message.includes("codigo_interno")) {
      try {
        codigoInsert = siguienteCodigoInternoMedicamento(
          await listarCodigosInternosMedicamentos(supabase)
        );
        continue;
      } catch {
        /* cae al return de abajo */
      }
      return {
        error: `El código interno "${codigoInsert}" ya está en uso. Intenta de nuevo.`,
        values: { ...valuesConResto, codigo_interno: codigoInsert },
      };
    }

    if (error.code === "23505") {
      return {
        error: "Ya existe un registro con esos datos únicos.",
        values: valuesConResto,
      };
    }
    return { error: error.message, values: valuesConResto };
  }

  return {
    error: "No se pudo asignar un código interno libre. Intenta de nuevo.",
    values: valuesConResto,
  };

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

  if (!nombre || !codigo_interno) {
    return {
      error: "Nombre y código interno son obligatorios.",
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
  const es_contra_receta = formData.get("es_contra_receta") === "on";
  const categoria = normalizarMedicamentoCategoria(
    formData.get("categoria")?.toString()
  );
  const unidad_medida = unidadMedidaDesdeCategoria(categoria);

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
      es_contra_receta,
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

async function contarReferenciasMedicamento(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  medicamentoId: string
): Promise<{ bloqueos: string[] }> {
  const tablas: { tabla: string; etiqueta: string }[] = [
    { tabla: "stock_mensual_posta", etiqueta: "stock mensual en postas" },
    { tabla: "movimientos_diarios_consumo", etiqueta: "consumos diarios" },
    { tabla: "ingresos_stock_mes", etiqueta: "ingresos de stock" },
    { tabla: "detalle_pedido_mensual", etiqueta: "líneas en pedidos mensuales" },
    { tabla: "stock_avis_mensual", etiqueta: "stock AVIS mensual" },
  ];

  const bloqueos: string[] = [];

  await Promise.all(
    tablas.map(async ({ tabla, etiqueta }) => {
      const { count, error } = await supabase
        .from(tabla)
        .select("*", { count: "exact", head: true })
        .eq("medicamento_id", medicamentoId);

      if (error) throw new Error(error.message);
      if (count && count > 0) {
        bloqueos.push(`${etiqueta} (${count})`);
      }
    })
  );

  return { bloqueos };
}

export async function deleteMedicamentoAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  const { profile } = await requirePerfilUsuario();
  if (!esAdminGeneral(profile)) {
    return { error: "Solo un administrador general puede eliminar medicamentos." };
  }

  const id = formData.get("id")?.toString().trim();
  if (!id) {
    return { error: "Falta el identificador del medicamento." };
  }

  if (formData.get("confirmar") !== "si") {
    return { error: "Debes confirmar la eliminación." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: med, error: medError } = await supabase
    .from("medicamentos")
    .select("id, nombre")
    .eq("id", id)
    .maybeSingle();

  if (medError) {
    return { error: medError.message };
  }
  if (!med || typeof med !== "object" || typeof (med as { id: unknown }).id !== "string") {
    return { error: "El medicamento no existe o ya fue eliminado." };
  }

  const nombre =
    typeof (med as { nombre: unknown }).nombre === "string"
      ? (med as { nombre: string }).nombre
      : "Medicamento";

  try {
    const { bloqueos } = await contarReferenciasMedicamento(supabase, id);
    if (bloqueos.length > 0) {
      return {
        error: `No se puede eliminar «${nombre}» porque tiene datos asociados: ${bloqueos.join(", ")}. Desmarca «Activo en catálogo» si solo quieres ocultarlo de los pedidos.`,
      };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo verificar el historial del medicamento.",
    };
  }

  const { error: deleteError } = await supabase.from("medicamentos").delete().eq("id", id);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return {
        error: `No se puede eliminar «${nombre}» porque aún tiene registros vinculados en el sistema. Desmarca «Activo en catálogo» para ocultarlo del catálogo.`,
      };
    }
    return { error: deleteError.message };
  }

  revalidatePath("/admin/medicamentos");
  revalidatePath("/admin");
  revalidatePath("/postas", "layout");

  return {
    success: `«${nombre}» fue eliminado del catálogo.`,
  };
}
