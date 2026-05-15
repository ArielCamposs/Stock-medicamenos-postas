import type { SupabaseClient } from "@supabase/supabase-js";

export type CierreMensualEstado = {
  id: string;
  cerradoEn: string;
  cerradoPor: string;
  resumen: Record<string, unknown>;
};

export async function obtenerCierreMensualPosta(
  supabase: SupabaseClient,
  postaId: string,
  anio: number,
  mes: number
): Promise<CierreMensualEstado | null> {
  const { data } = await supabase
    .from("cierres_mensuales_posta")
    .select("id, cerrado_en, cerrado_por, resumen, reabierto_en")
    .eq("posta_id", postaId)
    .eq("anio", anio)
    .eq("mes", mes)
    .is("reabierto_en", null)
    .maybeSingle();

  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.cerrado_en !== "string" ||
    typeof row.cerrado_por !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    cerradoEn: row.cerrado_en,
    cerradoPor: row.cerrado_por,
    resumen:
      row.resumen && typeof row.resumen === "object" && !Array.isArray(row.resumen)
        ? (row.resumen as Record<string, unknown>)
        : {},
  };
}

export async function mesEstaCerrado(
  supabase: SupabaseClient,
  postaId: string,
  anio: number,
  mes: number
): Promise<boolean> {
  return Boolean(await obtenerCierreMensualPosta(supabase, postaId, anio, mes));
}
