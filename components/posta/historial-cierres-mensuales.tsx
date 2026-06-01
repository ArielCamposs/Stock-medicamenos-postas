"use client";

import { useCallback, useState } from "react";

import { tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import {
  CierreConciliacionTabla,
  CierreResumenTarjetas,
} from "@/components/posta/cierre-conciliacion-tabla";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FilaConciliacionCierre } from "@/lib/posta/cierre-conciliacion-filas";
import type { HistorialCierreMensualItem } from "@/lib/posta/cierre-mensual";
import { cn } from "@/lib/utils";

function formatCerradoEn(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function formatCerradoEnTabla(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function resumenDesdeItem(item: HistorialCierreMensualItem) {
  return {
    disponible: item.resumen.totalDisponible,
    avis: item.resumen.totalAvis,
    diferencias: item.resumen.diferenciasAvis,
    bajoCritico: item.resumen.bajoCritico,
  };
}

export function HistorialCierresMensuales({
  postaId,
  items,
}: {
  postaId: string;
  items: HistorialCierreMensualItem[];
}) {
  const [seleccion, setSeleccion] = useState<HistorialCierreMensualItem | null>(null);
  const [filas, setFilas] = useState<FilaConciliacionCierre[] | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const abrirCierre = useCallback(
    async (item: HistorialCierreMensualItem) => {
      setSeleccion(item);
      setErrorDetalle(null);

      if (item.detalle && item.detalle.length > 0) {
        setFilas(item.detalle);
        setCargandoDetalle(false);
        return;
      }

      setFilas(null);
      setCargandoDetalle(true);
      try {
        const q = new URLSearchParams({
          anio: String(item.anio),
          mes: String(item.mes),
        });
        const res = await fetch(
          `/api/postas/${postaId}/cierre-mensual-detalle?${q.toString()}`
        );
        const body = (await res.json()) as {
          filas?: FilaConciliacionCierre[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error ?? "No se pudo cargar el detalle del cierre.");
        }
        setFilas(body.filas ?? []);
      } catch (e) {
        setErrorDetalle(
          e instanceof Error ? e.message : "No se pudo cargar el detalle del cierre."
        );
        setFilas([]);
      } finally {
        setCargandoDetalle(false);
      }
    },
    [postaId]
  );

  const cerrarModal = useCallback(() => {
    setSeleccion(null);
    setFilas(null);
    setErrorDetalle(null);
    setCargandoDetalle(false);
  }, []);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay cierres de mes registrados para esta posta.
      </p>
    );
  }

  const resumenModal = seleccion ? resumenDesdeItem(seleccion) : null;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-3">Mes</th>
              <th className="px-3 py-3">Cierre realizado</th>
              <th className="px-3 py-3">Resumen</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const reabierto = Boolean(item.reabiertoEn);
              return (
                <tr
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver cierre de ${tituloMesChile(item.anio, item.mes)}`}
                  className="cursor-pointer border-b border-border/60 last:border-0 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => void abrirCierre(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void abrirCierre(item);
                    }
                  }}
                >
                  <td className="px-3 py-3 font-medium whitespace-nowrap capitalize">
                    {tituloMesChile(item.anio, item.mes)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {formatCerradoEnTabla(item.cerradoEn)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">
                    {item.resumen.diferenciasAvis > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        {item.resumen.diferenciasAvis} dif.
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400">Sin dif.</span>
                    )}
                    {" · "}
                    {item.resumen.totalDisponible.toLocaleString("es-CL")} u. registro
                  </td>
                  <td className="px-3 py-3">
                    {reabierto ? (
                      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                        Reabierto
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Vigente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={seleccion !== null} onOpenChange={(open) => !open && cerrarModal()}>
        <DialogContent className="flex max-h-[min(90vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          {seleccion ? (
            <>
              <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
                <DialogTitle className="capitalize">
                  Cierre · {tituloMesChile(seleccion.anio, seleccion.mes)}
                </DialogTitle>
                <DialogDescription>
                  Cerrado el {formatCerradoEn(seleccion.cerradoEn)}
                  {seleccion.reabiertoEn ? (
                    <span className={cn("block mt-1 text-amber-700 dark:text-amber-400")}>
                      Este mes fue reabierto posteriormente para correcciones.
                    </span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {resumenModal ? <CierreResumenTarjetas resumen={resumenModal} /> : null}

                {cargandoDetalle ? (
                  <p className="text-sm text-muted-foreground">Cargando conciliación…</p>
                ) : errorDetalle ? (
                  <p className="text-sm text-destructive">{errorDetalle}</p>
                ) : filas ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Conciliación registro vs AVIS</p>
                    <CierreConciliacionTabla filas={filas} />
                    {!seleccion.detalle?.length ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Detalle calculado con los datos actuales del mes (cierre anterior sin
                        snapshot guardado).
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
