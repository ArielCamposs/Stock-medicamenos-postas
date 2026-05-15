import type { SupabaseClient } from "@supabase/supabase-js";

import { mesSiguiente } from "@/lib/domain/fecha-mes";

/** Alineado con el check `ck_stock_anio` en base de datos. */
const LEDGER_DESDE_ANIO = 2020;
const LEDGER_DESDE_MES = 1;

export type AgregadosMensualesMed = {
  ingPorMes: Map<string, number>;
  consPorMes: Map<string, number>;
};

export type AgregadosPorMedicamento = Map<string, AgregadosMensualesMed>;

export function ymKey(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function aseguraMed(
  agg: AgregadosPorMedicamento,
  medicamentoId: string
): AgregadosMensualesMed {
  let m = agg.get(medicamentoId);
  if (!m) {
    m = { ingPorMes: new Map(), consPorMes: new Map() };
    agg.set(medicamentoId, m);
  }
  return m;
}

/**
 * Carga totales por mes (YYYY-MM) de ingresos y descuentos diarios para varios medicamentos.
 */
export async function cargarAgregadosIngresoConsumoPorMedicamentos(
  supabase: SupabaseClient,
  postaId: string,
  medicamentoIds: string[]
): Promise<AgregadosPorMedicamento> {
  const agg: AgregadosPorMedicamento = new Map();
  if (medicamentoIds.length === 0) return agg;

  for (const id of medicamentoIds) {
    agg.set(id, { ingPorMes: new Map(), consPorMes: new Map() });
  }

  const [ingRes, conRes] = await Promise.all([
    supabase
      .from("ingresos_stock_mes")
      .select("medicamento_id,fecha,cantidad")
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .in("medicamento_id", medicamentoIds),
    supabase
      .from("movimientos_diarios_consumo")
      .select("medicamento_id,fecha,cantidad_con_avis,cantidad_sin_avis")
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .in("medicamento_id", medicamentoIds),
  ]);

  if (ingRes.data && Array.isArray(ingRes.data)) {
    for (const row of ingRes.data) {
      const r = row as Record<string, unknown>;
      const mid = r.medicamento_id;
      const f = r.fecha;
      if (typeof mid !== "string" || typeof f !== "string" || f.length < 7) continue;
      const q = Number(r.cantidad);
      if (!Number.isFinite(q)) continue;
      const k = f.slice(0, 7);
      const slot = aseguraMed(agg, mid);
      slot.ingPorMes.set(k, (slot.ingPorMes.get(k) ?? 0) + Math.trunc(q));
    }
  }

  if (conRes.data && Array.isArray(conRes.data)) {
    for (const row of conRes.data) {
      const r = row as Record<string, unknown>;
      const mid = r.medicamento_id;
      const f = r.fecha;
      if (typeof mid !== "string" || typeof f !== "string" || f.length < 7) continue;
      const con = Number(r.cantidad_con_avis);
      const sin = Number(r.cantidad_sin_avis);
      const c = Number.isFinite(con) ? Math.trunc(con) : 0;
      const s = Number.isFinite(sin) ? Math.trunc(sin) : 0;
      const k = f.slice(0, 7);
      const slot = aseguraMed(agg, mid);
      slot.consPorMes.set(k, (slot.consPorMes.get(k) ?? 0) + c + s);
    }
  }

  return agg;
}

/** Suma un ingreso recién insertado al agregado en memoria (mismo mes contable). */
export function sumarIngresoAAgregado(
  agg: AgregadosPorMedicamento,
  medicamentoId: string,
  anio: number,
  mes: number,
  cantidad: number
): void {
  const slot = agg.get(medicamentoId);
  if (!slot) return;
  const k = ymKey(anio, mes);
  const prev = slot.ingPorMes.get(k) ?? 0;
  slot.ingPorMes.set(k, prev + cantidad);
}

function mesEsAntesOIgual(a1: number, m1: number, a2: number, m2: number) {
  return a1 < a2 || (a1 === a2 && m1 <= m2);
}

function mesEsAntes(a1: number, m1: number, a2: number, m2: number) {
  return a1 < a2 || (a1 === a2 && m1 < m2);
}

/**
 * Saldo al cierre del mes calendario `(hastaAnio, hastaMes)`, encadenando desde
 * apertura 0 en enero 2020: cada mes `cierre = max(0, apertura + ingresos − descuentos)`.
 */
export function cierreFinDeMesAcumulado(
  agg: AgregadosPorMedicamento,
  medicamentoId: string,
  hastaAnio: number,
  hastaMes: number
): number {
  if (mesEsAntes(hastaAnio, hastaMes, LEDGER_DESDE_ANIO, LEDGER_DESDE_MES)) {
    return 0;
  }

  const slot = agg.get(medicamentoId);
  let apertura = 0;
  let a = LEDGER_DESDE_ANIO;
  let m = LEDGER_DESDE_MES;

  while (mesEsAntesOIgual(a, m, hastaAnio, hastaMes)) {
    const k = ymKey(a, m);
    const ing = slot?.ingPorMes.get(k) ?? 0;
    const cons = slot?.consPorMes.get(k) ?? 0;
    apertura = Math.max(0, apertura + ing - cons);
    const sig = mesSiguiente(a, m);
    a = sig.anio;
    m = sig.mes;
  }

  return apertura;
}
