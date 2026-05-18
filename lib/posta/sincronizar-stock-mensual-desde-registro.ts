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
  const { anio: ap, mes: mp } = mesAnterior(anio, mes);
  const agg = await cargarAgregadosIngresoConsumoPorMedicamentos(supabase, postaId, [
    medicamentoId,
  ]);
  const cierrePrev = cierreFinDeMesAcumulado(agg, medicamentoId, ap, mp);
  const ymk = ymKey(anio, mes);
  const totIng = agg.get(medicamentoId)?.ingPorMes.get(ymk) ?? 0;
  const totCons = agg.get(medicamentoId)?.consPorMes.get(ymk) ?? 0;
  const stockFinal = Math.max(0, cierrePrev + totIng - totCons);

  const [{ data: stockRow }, { data: med, error: eMed }] = await Promise.all([
    supabase
      .from("stock_mensual_posta")
      .select("id, stock_critico_config, stock_recomendado_config")
      .eq("posta_id", postaId)
      .eq("medicamento_id", medicamentoId)
      .eq("anio", anio)
      .eq("mes", mes)
      .maybeSingle(),
    supabase
      .from("medicamentos")
      .select("stock_recomendado_default, stock_critico_default")
      .eq("id", medicamentoId)
      .maybeSingle(),
  ]);

  if (eMed || !med || typeof med !== "object") {
    return { error: "No se encontró el medicamento." };
  }

  const recDef = Number(
    (med as { stock_recomendado_default?: number }).stock_recomendado_default
  );
  const critDef = Number(
    (med as { stock_critico_default?: number }).stock_critico_default
  );
  const recVal = Number.isFinite(recDef) ? Math.max(0, Math.trunc(recDef)) : 0;
  const critVal = Number.isFinite(critDef) ? Math.max(0, Math.trunc(critDef)) : 0;

  if (stockRow && typeof stockRow === "object" && "id" in stockRow) {
    const critCfg = Number(
      (stockRow as { stock_critico_config: number }).stock_critico_config
    );
    const recCfg = Number(
      (stockRow as { stock_recomendado_config: number }).stock_recomendado_config
    );
    const { error } = await supabase
      .from("stock_mensual_posta")
      .update({
        stock_inicial: cierrePrev,
        stock_ingresado_mes: totIng,
        stock_final: stockFinal,
        stock_critico_config: Number.isFinite(critCfg) ? critCfg : critVal,
        stock_recomendado_config: Number.isFinite(recCfg) ? recCfg : recVal,
      })
      .eq("id", (stockRow as { id: string }).id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("stock_mensual_posta").insert({
      posta_id: postaId,
      medicamento_id: medicamentoId,
      anio,
      mes,
      stock_inicial: cierrePrev,
      stock_ingresado_mes: totIng,
      stock_final: stockFinal,
      stock_critico_config: critVal,
      stock_recomendado_config: recVal,
    });
    if (error) return { error: error.message };
  }

  return {};
}
