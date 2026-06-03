import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compararMedicamentoPorCategoriaNombre,
  normalizarMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { rangoFechasMesISO } from "@/lib/domain/fecha-mes";
import {
  snapshotLedgerMesPosta,
  type MedLedgerMin,
} from "@/lib/posta/snapshot-ledger-mes-posta";

export type FilaConciliacionCierre = {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  categoria: MedicamentoCategoria;
  cierreAnterior: number;
  ingresoMes: number;
  descuentoMes: number;
  disponible: number;
  stockAvis: number;
  diferenciaAvis: number;
  stock_critico: number;
};

export function ordenarFilasConciliacionCierre(
  filas: FilaConciliacionCierre[]
): FilaConciliacionCierre[] {
  return [...filas].sort((a, b) =>
    compararMedicamentoPorCategoriaNombre(a.categoria, a.nombre, b.categoria, b.nombre)
  );
}

export type ResumenConciliacionCierre = {
  totalMedicamentos: number;
  disponible: number;
  avis: number;
  diferencias: number;
  bajoCritico: number;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function obtenerFilasConciliacionCierre(
  supabase: SupabaseClient,
  postaId: string,
  anio: number,
  mes: number
): Promise<{ filas: FilaConciliacionCierre[]; resumen: ResumenConciliacionCierre }> {
  const { desde, hasta } = rangoFechasMesISO(anio, mes);

  const [medicamentosRes, avisRes, curStockRes, movsRes] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, unidad_medida, categoria, stock_recomendado_default, stock_critico_default"
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("stock_avis_mensual")
      .select("medicamento_id, stock_avis_cantidad")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("stock_mensual_posta")
      .select("medicamento_id, stock_recomendado_config, stock_critico_config")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("movimientos_diarios_consumo")
      .select("medicamento_id, fecha, cantidad_con_avis, cantidad_sin_avis, total_dia")
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  const err =
    medicamentosRes.error?.message ??
    avisRes.error?.message ??
    curStockRes.error?.message ??
    movsRes.error?.message ??
    null;
  if (err) {
    throw new Error(err);
  }

  const meds: (MedLedgerMin & {
    nombre: string;
    codigo: string;
    unidad: string;
    categoria: MedicamentoCategoria;
  })[] = [];

  const medicamentos = medicamentosRes.data;
  if (Array.isArray(medicamentos)) {
    for (const row of medicamentos) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      meds.push({
        id: r.id,
        nombre: typeof r.nombre === "string" ? r.nombre : "—",
        codigo: typeof r.codigo_interno === "string" ? r.codigo_interno : "",
        unidad: typeof r.unidad_medida === "string" ? r.unidad_medida : "",
        categoria: normalizarMedicamentoCategoria(
          typeof r.categoria === "string" ? r.categoria : undefined
        ),
        stock_recomendado_default: toInt(r.stock_recomendado_default),
        stock_critico_default: toInt(r.stock_critico_default),
      });
    }
  }

  const avis = new Map<string, number>();
  const avisRows = avisRes.data;
  if (Array.isArray(avisRows)) {
    for (const row of avisRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        avis.set(r.medicamento_id, toInt(r.stock_avis_cantidad));
      }
    }
  }

  const snap = await snapshotLedgerMesPosta(supabase, postaId, anio, mes, meds, {
    curStockRows: curStockRes.data ?? [],
    movsMesRows: movsRes.data ?? [],
  });

  const filas: FilaConciliacionCierre[] = meds.map((m) => {
    const s = snap.get(m.id);
    const stockAvis = avis.get(m.id) ?? 0;
    const disponible = s?.disponible ?? 0;
    const stockCritico = s?.stock_critico ?? m.stock_critico_default;
    return {
      id: m.id,
      nombre: m.nombre,
      codigo: m.codigo,
      unidad: m.unidad,
      categoria: m.categoria,
      cierreAnterior: s?.cierre_mes_anterior ?? 0,
      ingresoMes: s?.ingreso_mes ?? 0,
      descuentoMes: s?.descuento_mes ?? 0,
      disponible,
      stockAvis,
      diferenciaAvis: stockAvis - disponible,
      stock_critico: stockCritico,
    };
  });

  const resumen: ResumenConciliacionCierre = {
    totalMedicamentos: filas.length,
    disponible: filas.reduce((acc, f) => acc + f.disponible, 0),
    avis: filas.reduce((acc, f) => acc + f.stockAvis, 0),
    diferencias: filas.filter((f) => f.diferenciaAvis !== 0).length,
    bajoCritico: filas.filter(
      (f) => f.stock_critico > 0 && f.disponible <= f.stock_critico
    ).length,
  };

  return { filas: ordenarFilasConciliacionCierre(filas), resumen };
}

export function parseDetalleDesdeResumenCierre(
  resumen: Record<string, unknown>
): FilaConciliacionCierre[] | null {
  const raw = resumen.detalle;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const filas: FilaConciliacionCierre[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    if (!id) continue;
    filas.push({
      id,
      nombre: typeof r.nombre === "string" ? r.nombre : "—",
      codigo: typeof r.codigo === "string" ? r.codigo : "",
      unidad: typeof r.unidad === "string" ? r.unidad : "",
      categoria: normalizarMedicamentoCategoria(
        typeof r.categoria === "string" ? r.categoria : undefined
      ),
      cierreAnterior: toInt(r.cierreAnterior),
      ingresoMes: toInt(r.ingresoMes),
      descuentoMes: toInt(r.descuentoMes),
      disponible: toInt(r.disponible),
      stockAvis: toInt(r.stockAvis),
      diferenciaAvis: toInt(r.diferenciaAvis),
      stock_critico: toInt(r.stock_critico),
    });
  }

  return filas.length > 0 ? ordenarFilasConciliacionCierre(filas) : null;
}
