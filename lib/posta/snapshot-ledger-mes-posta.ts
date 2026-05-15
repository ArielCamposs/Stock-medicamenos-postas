import type { SupabaseClient } from "@supabase/supabase-js";

import { mesAnterior, rangoFechasMesISO } from "@/lib/domain/fecha-mes";
import {
  cargarAgregadosIngresoConsumoPorMedicamentos,
  cierreFinDeMesAcumulado,
  ymKey,
} from "@/lib/posta/stock-cierre-mensual";

export type MedLedgerMin = {
  id: string;
  stock_recomendado_default: number;
  stock_critico_default: number;
};

export type SnapshotLedgerMes = {
  stock_recomendado: number;
  stock_critico: number;
  cierre_mes_anterior: number;
  ingreso_mes: number;
  descuento_mes: number;
  disponible: number;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export type SnapshotLedgerOpts = {
  /** Si vienen desde el caller, se evita volver a consultar `stock_mensual_posta` del mes. */
  curStockRows?: unknown[] | null;
  /** Movimientos del mes (mismo rango que `rangoFechasMesISO`); evita segunda query de descuentos del mes. */
  movsMesRows?: unknown[] | null;
};

/**
 * Totales del registro mensual (misma lógica que el panel de descuento).
 */
export async function snapshotLedgerMesPosta(
  supabase: SupabaseClient,
  postaId: string,
  anio: number,
  mes: number,
  meds: MedLedgerMin[],
  opts?: SnapshotLedgerOpts
): Promise<Map<string, SnapshotLedgerMes>> {
  const out = new Map<string, SnapshotLedgerMes>();
  if (meds.length === 0) return out;

  const { desde, hasta } = rangoFechasMesISO(anio, mes);
  const { anio: ap, mes: mp } = mesAnterior(anio, mes);
  const medIds = meds.map((m) => m.id);

  let curStock = opts?.curStockRows;
  if (curStock === undefined) {
    const { data } = await supabase
      .from("stock_mensual_posta")
      .select("medicamento_id, stock_recomendado_config, stock_critico_config")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes);
    curStock = data ?? [];
  }

  let movs = opts?.movsMesRows;
  if (movs === undefined) {
    const { data } = await supabase
      .from("movimientos_diarios_consumo")
      .select(
        "medicamento_id, fecha, cantidad_con_avis, cantidad_sin_avis, total_dia"
      )
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    movs = data ?? [];
  }

  const curMap = new Map<string, { rec: number; crit: number }>();
  if (Array.isArray(curStock)) {
    for (const row of curStock) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        curMap.set(r.medicamento_id, {
          rec: toInt(r.stock_recomendado_config),
          crit: toInt(r.stock_critico_config),
        });
      }
    }
  }

  const sumDescuentoMes = new Map<string, number>();
  if (movs && Array.isArray(movs)) {
    for (const row of movs) {
      const r = row as Record<string, unknown>;
      const mid = r.medicamento_id;
      if (typeof mid !== "string") continue;
      const total = toInt(r.total_dia);
      sumDescuentoMes.set(mid, (sumDescuentoMes.get(mid) ?? 0) + total);
    }
  }

  const aggLedger = await cargarAgregadosIngresoConsumoPorMedicamentos(
    supabase,
    postaId,
    medIds
  );
  const ymk = ymKey(anio, mes);

  for (const m of meds) {
    const cur = curMap.get(m.id);
    const stockRec = cur ? cur.rec : m.stock_recomendado_default;
    const stockCrit = cur ? cur.crit : m.stock_critico_default;
    const cierre = cierreFinDeMesAcumulado(aggLedger, m.id, ap, mp);
    const ingreso = aggLedger.get(m.id)?.ingPorMes.get(ymk) ?? 0;
    const cons = sumDescuentoMes.get(m.id) ?? 0;
    out.set(m.id, {
      stock_recomendado: stockRec,
      stock_critico: stockCrit,
      cierre_mes_anterior: cierre,
      ingreso_mes: ingreso,
      descuento_mes: cons,
      disponible: cierre + ingreso - cons,
    });
  }

  return out;
}
