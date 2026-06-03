import type { SupabaseClient } from "@supabase/supabase-js";

import { nombresCatalogoEquivalentes } from "@/lib/domain/nombre-catalogo";

export type TablaCatalogoNombre = "insumos" | "medicamentos";

type FilaNombre = { id: string; nombre: string };

export async function buscarDuplicadoNombreCatalogo(
  supabase: SupabaseClient,
  tabla: TablaCatalogoNombre,
  nombre: string,
  excluirId?: string
): Promise<FilaNombre | null> {
  const { data, error } = await supabase.from(tabla).select("id, nombre");

  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return null;

  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.nombre !== "string") continue;
    if (excluirId && r.id === excluirId) continue;
    if (nombresCatalogoEquivalentes(r.nombre, nombre)) {
      return { id: r.id, nombre: r.nombre };
    }
  }
  return null;
}

export function mensajeNombreCatalogoDuplicado(
  tipo: "insumo" | "medicamento",
  nombreExistente: string
): string {
  const etiqueta = tipo === "insumo" ? "insumo" : "medicamento";
  return `Ya existe un ${etiqueta} con el nombre «${nombreExistente}». Usa otro nombre o edita el registro existente.`;
}

export function mensajeErrorNombreCatalogoDesdeDb(
  tipo: "insumo" | "medicamento",
  error: { code?: string; message?: string }
): string | null {
  if (error.code !== "23505") return null;
  const msg = error.message ?? "";
  if (
    msg.includes("nombre_norm") ||
    msg.includes("idx_insumos_nombre_norm") ||
    msg.includes("idx_medicamentos_nombre_norm")
  ) {
    return tipo === "insumo"
      ? "Ya existe un insumo con ese nombre (no se permiten duplicados, aunque cambien mayúsculas o espacios)."
      : "Ya existe un medicamento con ese nombre (no se permiten duplicados, aunque cambien mayúsculas o espacios).";
  }
  return null;
}
