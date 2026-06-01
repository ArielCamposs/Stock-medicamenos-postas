import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseDetalleDesdeResumenCierre,
  type FilaConciliacionCierre,
} from "@/lib/posta/cierre-conciliacion-filas";

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
  const { data, error } = await supabase
    .from("cierres_mensuales_posta")
    .select("id, cerrado_en, cerrado_por, resumen, reabierto_en")
    .eq("posta_id", postaId)
    .eq("anio", anio)
    .eq("mes", mes)
    .is("reabierto_en", null)
    .maybeSingle();

  if (error) {
    return null;
  }

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

export type HistorialCierreMensualItem = {
  id: string;
  anio: number;
  mes: number;
  cerradoEn: string;
  reabiertoEn: string | null;
  resumen: {
    totalMedicamentos: number;
    totalDisponible: number;
    totalAvis: number;
    diferenciasAvis: number;
    bajoCritico: number;
  };
  detalle: FilaConciliacionCierre[] | null;
};

function parseResumenHistorial(raw: unknown): HistorialCierreMensualItem["resumen"] {
  const base = {
    totalMedicamentos: 0,
    totalDisponible: 0,
    totalAvis: 0,
    diferenciasAvis: 0,
    bajoCritico: 0,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(r[k]);
    return Number.isFinite(v) ? Math.trunc(v) : 0;
  };
  return {
    totalMedicamentos: n("totalMedicamentos"),
    totalDisponible: n("totalDisponible"),
    totalAvis: n("totalAvis"),
    diferenciasAvis: n("diferenciasAvis"),
    bajoCritico: n("bajoCritico"),
  };
}

export async function listarHistorialCierresMensualesPosta(
  supabase: SupabaseClient,
  postaId: string
): Promise<HistorialCierreMensualItem[]> {
  const { data, error } = await supabase
    .from("cierres_mensuales_posta")
    .select("id, anio, mes, cerrado_en, reabierto_en, resumen")
    .eq("posta_id", postaId)
    .order("cerrado_en", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const items: HistorialCierreMensualItem[] = [];
  if (!Array.isArray(data)) return items;

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      typeof r.cerrado_en !== "string" ||
      typeof r.anio !== "number" ||
      typeof r.mes !== "number"
    ) {
      continue;
    }

    const resumenObj =
      r.resumen && typeof r.resumen === "object" && !Array.isArray(r.resumen)
        ? (r.resumen as Record<string, unknown>)
        : {};

    items.push({
      id: r.id,
      anio: r.anio,
      mes: r.mes,
      cerradoEn: r.cerrado_en,
      reabiertoEn:
        typeof r.reabierto_en === "string" ? r.reabierto_en : null,
      resumen: parseResumenHistorial(resumenObj),
      detalle: parseDetalleDesdeResumenCierre(resumenObj),
    });
  }

  return items;
}
