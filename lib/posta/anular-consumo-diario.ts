import type { SupabaseClient } from "@supabase/supabase-js";

import { anioMesActual } from "@/lib/domain/fecha-mes";
import {
  sincronizarStockMensualDesdeRegistro,
  validarMesAbierto,
} from "@/lib/posta/sincronizar-stock-mensual-desde-registro";

export type AnularConsumoDiarioParams = {
  postaId: string;
  medicamentoId: string;
  fecha: string;
  motivo: string;
  userId: string;
};

export type AnularConsumoDiarioResult =
  | { ok: true; entityId: string }
  | { ok: false; error: string };

export async function anularConsumoDiario(
  supabase: SupabaseClient,
  params: AnularConsumoDiarioParams
): Promise<AnularConsumoDiarioResult> {
  const { postaId, medicamentoId, fecha, motivo, userId } = params;

  const { anio, mes } = anioMesActual(new Date(fecha + "T12:00:00"));
  const abierto = await validarMesAbierto(supabase, postaId, anio, mes);
  if (!abierto.ok) {
    return { ok: false, error: abierto.error };
  }

  const { data: row, error: selErr } = await supabase
    .from("movimientos_diarios_consumo")
    .select("id")
    .eq("posta_id", postaId)
    .eq("medicamento_id", medicamentoId)
    .eq("fecha", fecha)
    .eq("anulado", false)
    .maybeSingle();

  if (selErr) {
    return { ok: false, error: selErr.message };
  }
  if (!row) {
    return { ok: false, error: "No había un descuento activo para ese día y medicamento." };
  }

  const { error } = await supabase
    .from("movimientos_diarios_consumo")
    .update({
      anulado: true,
      anulado_por: userId,
      anulado_en: new Date().toISOString(),
      motivo_anulacion: motivo,
    })
    .eq("posta_id", postaId)
    .eq("medicamento_id", medicamentoId)
    .eq("fecha", fecha)
    .eq("anulado", false);

  if (error) {
    return { ok: false, error: error.message };
  }

  const sync = await sincronizarStockMensualDesdeRegistro(
    supabase,
    postaId,
    medicamentoId,
    anio,
    mes
  );
  if (sync.error) {
    return { ok: false, error: sync.error };
  }

  return { ok: true, entityId: String(row.id) };
}
