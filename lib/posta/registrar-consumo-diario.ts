import { revalidatePath } from "next/cache";

import { anioMesActual } from "@/lib/domain/fecha-mes";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import {
  sincronizarStockMensualDesdeRegistro,
  validarMesAbierto,
  type SupabaseSrv,
} from "@/lib/posta/sincronizar-stock-mensual-desde-registro";

export type RegistrarConsumoDiarioInput = {
  postaId: string;
  medicamentoId: string;
  fecha: string;
  cantidadConAvis: number;
  cantidadSinAvis: number;
  observacion: string | null;
  clientSyncId?: string | null;
  userId: string;
};

export type RegistrarConsumoDiarioResult =
  | { ok: true; entityId: string | null }
  | { ok: false; error: string };

export function validarCamposConsumoDiario(input: {
  fecha: string;
  medicamentoId: string;
  cantidadConAvis: number;
  cantidadSinAvis: number;
}): string | null {
  if (
    !input.fecha ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ||
    !input.medicamentoId
  ) {
    return "Fecha o medicamento no válidos.";
  }
  if (
    Number.isNaN(input.cantidadConAvis) ||
    Number.isNaN(input.cantidadSinAvis) ||
    input.cantidadConAvis < 0 ||
    input.cantidadSinAvis < 0
  ) {
    return "Las cantidades deben ser números enteros mayores o iguales a 0.";
  }
  return null;
}

export async function registrarConsumoDiario(
  supabase: SupabaseSrv,
  input: RegistrarConsumoDiarioInput
): Promise<RegistrarConsumoDiarioResult> {
  const campoErr = validarCamposConsumoDiario({
    fecha: input.fecha,
    medicamentoId: input.medicamentoId,
    cantidadConAvis: input.cantidadConAvis,
    cantidadSinAvis: input.cantidadSinAvis,
  });
  if (campoErr) {
    return { ok: false, error: campoErr };
  }

  const { anio, mes } = anioMesActual(new Date(input.fecha + "T12:00:00"));
  const abierto = await validarMesAbierto(supabase, input.postaId, anio, mes);
  if (!abierto.ok) {
    return { ok: false, error: abierto.error };
  }

  if (input.clientSyncId) {
    const { data: porSync } = await supabase
      .from("movimientos_diarios_consumo")
      .select("id")
      .eq("client_sync_id", input.clientSyncId)
      .maybeSingle();

    if (porSync && typeof porSync === "object" && "id" in porSync) {
      return { ok: true, entityId: String((porSync as { id: string }).id) };
    }
  }

  const { data: previo } = await supabase
    .from("movimientos_diarios_consumo")
    .select(
      "id, cantidad_con_avis, cantidad_sin_avis, total_dia, observacion, anulado"
    )
    .eq("posta_id", input.postaId)
    .eq("medicamento_id", input.medicamentoId)
    .eq("fecha", input.fecha)
    .maybeSingle();

  const row: Record<string, unknown> = {
    posta_id: input.postaId,
    medicamento_id: input.medicamentoId,
    fecha: input.fecha,
    cantidad_con_avis: input.cantidadConAvis,
    cantidad_sin_avis: input.cantidadSinAvis,
    observacion: input.observacion,
    anulado: false,
    anulado_por: null,
    anulado_en: null,
    motivo_anulacion: null,
    created_by: input.userId,
  };
  if (input.clientSyncId) {
    row.client_sync_id = input.clientSyncId;
  }

  const { error } = await supabase.from("movimientos_diarios_consumo").upsert(row, {
    onConflict: "posta_id,medicamento_id,fecha",
  });

  if (error) {
    if (input.clientSyncId && error.code === "23505") {
      const { data: dup } = await supabase
        .from("movimientos_diarios_consumo")
        .select("id")
        .eq("client_sync_id", input.clientSyncId)
        .maybeSingle();
      if (dup && typeof dup === "object" && "id" in dup) {
        return { ok: true, entityId: String((dup as { id: string }).id) };
      }
    }
    return { ok: false, error: error.message };
  }

  const sync = await sincronizarStockMensualDesdeRegistro(
    supabase,
    input.postaId,
    input.medicamentoId,
    anio,
    mes
  );
  if (sync.error) {
    return { ok: false, error: sync.error };
  }

  const { data: guardado } = await supabase
    .from("movimientos_diarios_consumo")
    .select("id")
    .eq("posta_id", input.postaId)
    .eq("medicamento_id", input.medicamentoId)
    .eq("fecha", input.fecha)
    .maybeSingle();

  await registrarAuditLog(supabase, {
    actorId: input.userId,
    action: previo ? "consumo_diario.corregido" : "consumo_diario.creado",
    entity: "movimientos_diarios_consumo",
    entityId:
      guardado && typeof guardado === "object" && "id" in guardado
        ? String((guardado as { id: string }).id)
        : previo && typeof previo === "object" && "id" in previo
          ? String((previo as { id: string }).id)
          : null,
    metadata: {
      postaId: input.postaId,
      medicamentoId: input.medicamentoId,
      fecha: input.fecha,
      clientSyncId: input.clientSyncId ?? null,
      anterior: previo ?? null,
      nuevo: {
        cantidad_con_avis: input.cantidadConAvis,
        cantidad_sin_avis: input.cantidadSinAvis,
        observacion: input.observacion,
      },
    },
  });

  return {
    ok: true,
    entityId:
      guardado && typeof guardado === "object" && "id" in guardado
        ? String((guardado as { id: string }).id)
        : null,
  };
}

export function revalidateRutasTrasConsumoDiario(postaId: string) {
  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/medicamentos");
  revalidatePath("/admin");
}
