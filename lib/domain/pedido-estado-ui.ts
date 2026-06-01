export type PedidoEstadoUi =
  | "BORRADOR"
  | "ENVIADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "APROBADO"
  | "DESPACHADO"
  | "RECIBIDO";

export const pedidoEstadoUiConfig: Record<
  PedidoEstadoUi,
  { label: string; className: string }
> = {
  BORRADOR: {
    label: "Borrador",
    className:
      "border-border bg-muted/80 text-muted-foreground",
  },
  ENVIADO: {
    label: "Enviado",
    className:
      "border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100",
  },
  OBSERVADO: {
    label: "Observado",
    className:
      "border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100",
  },
  RECHAZADO: {
    label: "Rechazado",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive",
  },
  APROBADO: {
    label: "Aprobado",
    className:
      "border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
  },
  DESPACHADO: {
    label: "Despachado",
    className:
      "border-violet-500/35 bg-violet-500/12 text-violet-950 dark:text-violet-100",
  },
  RECIBIDO: {
    label: "Recibido",
    className:
      "border-emerald-600/40 bg-emerald-600/20 text-emerald-950 dark:text-emerald-50",
  },
};

export function etiquetaPedidoEstado(estado: string): string {
  const cfg = pedidoEstadoUiConfig[estado as PedidoEstadoUi];
  return cfg?.label ?? estado.replaceAll("_", " ");
}

/** Etiqueta corta para pestañas y resúmenes. */
export function etiquetaPedidoEstadoCorto(estado: PedidoEstadoUi): string {
  return etiquetaPedidoEstado(estado);
}
