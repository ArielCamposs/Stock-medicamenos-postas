import { mesAnterior } from "@/lib/domain/fecha-mes";
import { mesEstaCerrado } from "@/lib/posta/cierre-mensual";
import {
  cargarAgregadosIngresoConsumoPorMedicamentos,
  cierreFinDeMesAcumulado,
  ymKey,
} from "@/lib/posta/stock-cierre-mensual";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

export type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function validarMesAbierto(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await mesEstaCerrado(supabase, postaId, anio, mes)) {
    return {
      ok: false,
      error:
        "Este mes ya está cerrado. Solicita reapertura a administración antes de corregir o registrar movimientos.",
    };
  }
  return { ok: true };
}

/** Recalcula `stock_mensual_posta` del mes a partir del registro (ingresos + descuentos en base). */
export async function sincronizarStockMensualDesdeRegistro(
  supabase: SupabaseSrv,
  postaId: string,
  medicamentoId: string,
  anio: number,
  mes: number
): Promise<{ error?: string }> {
  return sincronizarStockMensualLote(supabase, postaId, [medicamentoId], anio, mes);
}

/**
 * Versión en lote: recalcula `stock_mensual_posta` para varios medicamentos en una sola pasada.
 * Usa mucho menos round-trips que llamar a `sincronizarStockMensualDesdeRegistro` N veces.
 */
export async function sincronizarStockMensualLote(
  supabase: SupabaseSrv,
  postaId: string,
  medicamentoIds: string[],
  anio: number,
  mes: number
): Promise<{ error?: string }> {
  if (medicamentoIds.length === 0) return {};

  const { anio: ap, mes: mp } = mesAnterior(anio, mes);
  const ymk = ymKey(anio, mes);

  // Una sola llamada para obtener todos los agregados de todos los medicamentos.
  const [agg, { data: medsData, error: eMeds }, { data: stockRows }] = await Promise.all([
    cargarAgregadosIngresoConsumoPorMedicamentos(supabase, postaId, medicamentoIds),
    supabase
      .from("medicamentos")
      .select("id, stock_recomendado_default, stock_critico_default")
      .in("id", medicamentoIds),
    supabase
      .from("stock_mensual_posta")
      .select("id, medicamento_id, stock_critico_config, stock_recomendado_config")
      .eq("posta_id", postaId)
      .in("medicamento_id", medicamentoIds)
      .eq("anio", anio)
      .eq("mes", mes),
  ]);

  if (eMeds || !medsData) return { error: "No se encontraron los medicamentos." };

  // Índices para acceso O(1).
  const medDefaults = new Map<string, { rec: number; crit: number }>();
  for (const m of medsData) {
    const r = m as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    const rec = Number(r.stock_recomendado_default);
    const crit = Number(r.stock_critico_default);
    medDefaults.set(r.id, {
      rec: Number.isFinite(rec) ? Math.max(0, Math.trunc(rec)) : 0,
      crit: Number.isFinite(crit) ? Math.max(0, Math.trunc(crit)) : 0,
    });
  }

  const stockExistente = new Map<string, { id: string; recCfg: number; critCfg: number }>();
  if (stockRows) {
    for (const s of stockRows) {
      const r = s as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.medicamento_id !== "string") continue;
      stockExistente.set(r.medicamento_id, {
        id: r.id,
        recCfg: Number(r.stock_recomendado_config),
        critCfg: Number(r.stock_critico_config),
      });
    }
  }

  // Calcular y upsert en batch.
  const upsertRows = medicamentoIds.map((medicamentoId) => {
    const cierrePrev = cierreFinDeMesAcumulado(agg, medicamentoId, ap, mp);
    const totIng = agg.get(medicamentoId)?.ingPorMes.get(ymk) ?? 0;
    const totCons = agg.get(medicamentoId)?.consPorMes.get(ymk) ?? 0;
    const stockFinal = Math.max(0, cierrePrev + totIng - totCons);
    const defaults = medDefaults.get(medicamentoId) ?? { rec: 0, crit: 0 };
    const existente = stockExistente.get(medicamentoId);
    return {
      posta_id: postaId,
      medicamento_id: medicamentoId,
      anio,
      mes,
      stock_inicial: cierrePrev,
      stock_ingresado_mes: totIng,
      stock_final: stockFinal,
      stock_critico_config: existente
        ? (Number.isFinite(existente.critCfg) ? existente.critCfg : defaults.crit)
        : defaults.crit,
      stock_recomendado_config: existente
        ? (Number.isFinite(existente.recCfg) ? existente.recCfg : defaults.rec)
        : defaults.rec,
    };
  });

  const { error } = await supabase
    .from("stock_mensual_posta")
    .upsert(upsertRows, { onConflict: "posta_id,medicamento_id,anio,mes" });

  if (error) return { error: error.message };
  return {};
}
