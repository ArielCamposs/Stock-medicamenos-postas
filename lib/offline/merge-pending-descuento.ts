import type { ConsumoDiaCelda, ConsumoMensualMedPayload } from "@/components/posta/consumo-mensual-panel";
import type { LocalMovement } from "@/lib/offline/types";

/**
 * Superpone movimientos locales (pending/error) sobre el payload del servidor.
 * Para la misma celda (medicamento + fecha), gana el registro local activo.
 */
export function mergePendingIntoMedicamentos(
  medicamentos: ConsumoMensualMedPayload[],
  pending: LocalMovement[]
): ConsumoMensualMedPayload[] {
  const activos = pending.filter((m) => m.estado === "pending" || m.estado === "error");
  if (activos.length === 0) {
    return medicamentos.map((med) => ({
      ...med,
      dias: med.dias.map((d) => ({ ...d })),
    }));
  }

  const byMedFecha = new Map<string, LocalMovement>();
  for (const m of activos) {
    byMedFecha.set(`${m.medicamentoId}|${m.fechaConsumo}`, m);
  }

  return medicamentos.map((med) => ({
    ...med,
    dias: med.dias.map((d) => {
      const local = byMedFecha.get(`${med.id}|${d.fechaISO}`);
      if (!local) {
        return { ...d };
      }
      const total = local.cantidadConAvis + local.cantidadSinAvis;
      return {
        ...d,
        con: local.cantidadConAvis,
        sin: local.cantidadSinAvis,
        total,
        observacion: local.observacion,
        syncPendiente: local.estado === "pending",
        syncError: local.estado === "error",
        syncErrorMessage: local.errorMessage,
      };
    }),
  }));
}
