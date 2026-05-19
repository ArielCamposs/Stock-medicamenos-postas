import {
  addLocalMovement,
  deleteMovement,
  getLocalMovementsByDate,
} from "@/lib/offline/db";

export async function encolarAnulacionLocal(params: {
  postaId: string;
  medicamentoId: string;
  fechaISO: string;
  motivo: string;
  /** Si el día ya existía en el servidor al abrir el modal. */
  teniaRegistroEnServidor: boolean;
}): Promise<void> {
  const { postaId, medicamentoId, fechaISO, motivo, teniaRegistroEnServidor } = params;

  const locales = await getLocalMovementsByDate({
    postaId,
    fecha: fechaISO,
  });

  for (const m of locales) {
    if (
      m.medicamentoId === medicamentoId &&
      (m.estado === "pending" || m.estado === "error")
    ) {
      await deleteMovement(m.idLocal);
    }
  }

  if (!teniaRegistroEnServidor) {
    return;
  }

  await addLocalMovement({
    idLocal: crypto.randomUUID(),
    postaId,
    medicamentoId,
    fechaConsumo: fechaISO,
    cantidadConAvis: 0,
    cantidadSinAvis: 0,
    observacion: null,
    accion: "anular",
    motivoAnulacion: motivo,
    estado: "pending",
  });
}
