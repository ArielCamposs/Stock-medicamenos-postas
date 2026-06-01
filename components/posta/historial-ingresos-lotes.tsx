"use client";

import { FileSpreadsheet } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildIngresoLoteXlsxBuffer } from "@/lib/reportes/ingreso-lote-xlsx";
import { cn } from "@/lib/utils";

export type IngresoLineaHistorial = {
  id: string;
  cantidad: number;
  anulado: boolean;
  medNombre: string;
  medCodigo: string;
  unidadMedida: string;
  observacion: string | null;
};

export type IngresoLoteHistorial = {
  id: string;
  fecha: string;
  registradoEn: string;
  observacion: string | null;
  lineas: IngresoLineaHistorial[];
};

function formatFechaEs(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRegistradoEn(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function nombreArchivoIngreso(loteId: string, fecha: string) {
  return `ingreso-${fecha}-${loteId.slice(0, 8)}.xlsx`;
}

function resumenLote(lineas: IngresoLineaHistorial[]) {
  const activas = lineas.filter((l) => !l.anulado);
  const nMedicamentos = activas.length;
  const totalUnidades = activas.reduce((acc, l) => acc + l.cantidad, 0);
  const nAnuladas = lineas.length - nMedicamentos;
  return { nMedicamentos, totalUnidades, nAnuladas };
}

function DetalleIngresoTabla({ lote }: { lote: IngresoLoteHistorial }) {
  const { nMedicamentos, nAnuladas } = resumenLote(lote.lineas);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {lote.observacion ? (
        <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Observación</dt>
          <dd>{lote.observacion}</dd>
        </dl>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Medicamento</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {lote.lineas.map((linea) => (
              <tr
                key={linea.id}
                className={cn(
                  "border-b border-border/50 last:border-0",
                  linea.anulado && "text-muted-foreground line-through"
                )}
              >
                <td className="px-3 py-2 align-top">
                  <span className={cn(!linea.anulado && "font-medium")}>{linea.medNombre}</span>
                  {linea.medCodigo ? (
                    <span className="ml-1 text-muted-foreground no-underline">
                      ({linea.medCodigo})
                    </span>
                  ) : null}
                  {linea.unidadMedida ? (
                    <span className="ml-1 text-xs text-muted-foreground no-underline">
                      · {linea.unidadMedida}
                    </span>
                  ) : null}
                  {linea.anulado ? (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide no-underline">
                      Anulado
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums align-top">
                  {linea.cantidad.toLocaleString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nAnuladas > 0 && nMedicamentos > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {nAnuladas} {nAnuladas === 1 ? "línea anulada" : "líneas anuladas"} en este ingreso.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Los ingresos registrados son inmutables por seguridad del inventario.
      </p>
    </div>
  );
}

export function HistorialIngresosLotes({
  postaNombre,
  postaCodigo,
  lotes,
}: {
  postaNombre: string;
  postaCodigo: string | null;
  lotes: IngresoLoteHistorial[];
}) {
  const [seleccion, setSeleccion] = useState<IngresoLoteHistorial | null>(null);
  const [exportandoId, setExportandoId] = useState<string | null>(null);

  const exportarLote = useCallback(
    async (lote: IngresoLoteHistorial) => {
      setExportandoId(lote.id);
      try {
        const buffer = await buildIngresoLoteXlsxBuffer({
          postaNombre,
          postaCodigo,
          loteId: lote.id,
          fechaIngreso: formatFechaEs(lote.fecha),
          registradoEn: formatRegistradoEn(lote.registradoEn),
          observacion: lote.observacion,
          lineas: lote.lineas.map((l) => ({
            medNombre: l.medNombre,
            medCodigo: l.medCodigo,
            unidadMedida: l.unidadMedida,
            cantidad: l.cantidad,
            anulado: l.anulado,
          })),
        });
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreArchivoIngreso(lote.id, lote.fecha);
        a.click();
        URL.revokeObjectURL(url);
      } finally {
        setExportandoId(null);
      }
    },
    [postaCodigo, postaNombre]
  );

  if (lotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay ingresos registrados para esta posta.
      </p>
    );
  }

  const resumenSeleccion = seleccion ? resumenLote(seleccion.lineas) : null;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-3">Fecha ingreso</th>
              <th className="px-3 py-3">Registrado</th>
              <th className="px-3 py-3">Contenido</th>
              <th className="px-3 py-3 text-right">Excel</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => {
              const { nMedicamentos, totalUnidades } = resumenLote(lote.lineas);
              const todoAnulado = nMedicamentos === 0 && lote.lineas.length > 0;

              return (
                <tr
                  key={lote.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver ingreso del ${formatFechaEs(lote.fecha)}`}
                  className={cn(
                    "cursor-pointer border-b border-border/60 last:border-0 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    todoAnulado && "opacity-70"
                  )}
                  onClick={() => setSeleccion(lote)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSeleccion(lote);
                    }
                  }}
                >
                  <td className="px-3 py-3 font-medium whitespace-nowrap">
                    {formatFechaEs(lote.fecha)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {formatRegistradoEn(lote.registradoEn)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {todoAnulado ? (
                      <span className="text-muted-foreground">Anulado</span>
                    ) : (
                      <>
                        {nMedicamentos}{" "}
                        {nMedicamentos === 1 ? "medicamento" : "medicamentos"} ·{" "}
                        {totalUnidades.toLocaleString("es-CL")} uds
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={exportandoId === lote.id}
                      onClick={() => void exportarLote(lote)}
                    >
                      <FileSpreadsheet className="size-3.5" aria-hidden />
                      {exportandoId === lote.id ? "…" : "Excel"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Clic en una fila para ver el detalle. Los registros no se pueden editar.
      </p>

      <Dialog
        open={seleccion !== null}
        onOpenChange={(open) => {
          if (!open) setSeleccion(null);
        }}
      >
        <DialogContent
          className="flex max-h-[min(85dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton
        >
          {seleccion ? (
            <>
              <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-5">
                <DialogTitle>Ingreso · {formatFechaEs(seleccion.fecha)}</DialogTitle>
                <DialogDescription>
                  Registrado {formatRegistradoEn(seleccion.registradoEn)}
                  {resumenSeleccion && !resumenSeleccion.nMedicamentos ? null : (
                    <>
                      {" "}
                      · {resumenSeleccion?.nMedicamentos}{" "}
                      {resumenSeleccion?.nMedicamentos === 1
                        ? "medicamento"
                        : "medicamentos"}{" "}
                      · {resumenSeleccion?.totalUnidades.toLocaleString("es-CL")} uds
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-5">
                <DetalleIngresoTabla lote={seleccion} />
              </div>
              <div className="shrink-0 border-t bg-muted/30 px-4 py-3 sm:px-5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={exportandoId === seleccion.id}
                  onClick={() => void exportarLote(seleccion)}
                >
                  <FileSpreadsheet className="size-3.5" aria-hidden />
                  {exportandoId === seleccion.id ? "Generando…" : "Exportar Excel"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
