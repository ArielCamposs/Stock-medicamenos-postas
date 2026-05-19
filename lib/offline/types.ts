export type LocalMovementStatus = "pending" | "synced" | "error";

export type LocalMovementAccion = "registrar" | "anular";

/** Descuento diario guardado localmente (IndexedDB) antes o durante sync. */
export type LocalMovement = {
  idLocal: string;
  postaId: string;
  medicamentoId: string;
  fechaConsumo: string;
  cantidadConAvis: number;
  cantidadSinAvis: number;
  observacion: string | null;
  accion?: LocalMovementAccion;
  motivoAnulacion?: string | null;
  estado: LocalMovementStatus;
  errorMessage?: string;
  createdAtLocal: string;
  syncedAt?: string;
};

export type AddLocalMovementInput = Omit<
  LocalMovement,
  "estado" | "createdAtLocal" | "syncedAt" | "errorMessage"
> & {
  estado?: LocalMovementStatus;
};
