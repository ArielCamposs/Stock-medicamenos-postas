"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { FileSpreadsheet, X } from "lucide-react";
import { useCallback, useState } from "react";

import { AprobarPedidoButton } from "@/components/admin/aprobar-pedido-button";
import { PedidoBandejaListoButton } from "@/components/admin/pedido-bandeja-listo-button";
import { PedidoEstadoBadge } from "@/components/posta/pedido-estado-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildPedidosHistorialAdminXlsxBuffer } from "@/lib/reportes/pedidos-historial-admin-xlsx";
import { cn } from "@/lib/utils";

export type AdminPedidoTablaFila = {
  id: string;
  postaId: string;
  anio: number;
  mes: number;
  mesTitulo: string;
  estado: string;
  enviadoEtiqueta: string;
  postaNombre: string;
  postaCodigo: string | null;
  bandejaListo: boolean;
  pendienteBandeja: boolean;
  puedePdf: boolean;
};

type Props = {
  filas: AdminPedidoTablaFila[];
  puedeGestionarBandeja: boolean;
};

function ymPedido(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function nombreArchivoPedido(fila: AdminPedidoTablaFila) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `pedido-${fila.id.slice(0, 8)}-${y}-${m}-${day}.xlsx`;
}

/** En supervisión: si no está marcado listo en bandeja, mostramos solo «Pendiente». */
function etiquetaEstadoAdmin(f: Pick<AdminPedidoTablaFila, "estado" | "bandejaListo">) {
  if (!f.bandejaListo) return "Pendiente";
  return f.estado;
}

function filaAXlsxPayload(f: AdminPedidoTablaFila) {
  return {
    postaNombre: f.postaNombre,
    postaCodigo: f.postaCodigo,
    mesTitulo: f.mesTitulo,
    estado: etiquetaEstadoAdmin(f),
    enviadoEtiqueta: f.enviadoEtiqueta,
    pendienteBandeja: f.pendienteBandeja ? "Sí" : "No",
    bandejaListo: f.bandejaListo ? "Sí" : "No",
    pedidoId: f.id,
  };
}

export function AdminPedidosHistorialInteractivo({ filas, puedeGestionarBandeja }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<AdminPedidoTablaFila | null>(null);
  const [exportando, setExportando] = useState(false);

  const abrirPedido = useCallback((f: AdminPedidoTablaFila) => {
    setSeleccion(f);
    setModalAbierto(true);
  }, []);

  const exportarExcelSeleccion = useCallback(async () => {
    if (!seleccion) return;
    setExportando(true);
    try {
      const buffer = await buildPedidosHistorialAdminXlsxBuffer([filaAXlsxPayload(seleccion)]);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivoPedido(seleccion);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }, [seleccion]);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-3 align-middle">Posta</th>
              <th className="px-3 py-3 align-middle">Mes</th>
              <th className="px-3 py-3 align-middle">Estado</th>
              <th className="px-3 py-3 align-middle">Enviado</th>
              <th className="px-3 py-3 align-middle text-right">PDF</th>
              {puedeGestionarBandeja ? (
                <th className="px-3 py-3 align-middle text-right">Listo</th>
              ) : null}
              <th className="px-3 py-3 align-middle text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={`Abrir detalle del pedido de ${r.postaNombre}, ${r.mesTitulo}`}
                className={cn(
                  "cursor-pointer border-b border-border/60 last:border-0 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  r.bandejaListo && "bg-emerald-500/12 dark:bg-emerald-500/10",
                  !r.bandejaListo && r.pendienteBandeja && "bg-amber-500/10 dark:bg-amber-500/10"
                )}
                onClick={() => abrirPedido(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    abrirPedido(r);
                  }
                }}
              >
                <td className="px-3 py-3 align-middle">
                  <span className="font-medium">{r.postaNombre}</span>
                  {r.postaCodigo ? (
                    <span className="ml-1 text-muted-foreground">({r.postaCodigo})</span>
                  ) : null}
                  {r.pendienteBandeja ? (
                    <span className="ml-2 rounded bg-amber-500/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-950 dark:text-amber-100">
                      Bandeja
                    </span>
                  ) : null}
                  {r.bandejaListo ? (
                    <span className="ml-2 rounded bg-emerald-600/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                      Listo
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-middle capitalize">{r.mesTitulo}</td>
                <td className="px-3 py-3 align-middle">
                  {r.bandejaListo ? (
                    <PedidoEstadoBadge estado={r.estado} />
                  ) : (
                    <span className="inline-flex h-5 items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 text-[11px] font-medium uppercase tracking-wide text-amber-950 dark:text-amber-100">
                      Pendiente
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle text-muted-foreground">{r.enviadoEtiqueta}</td>
                <td className="px-3 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                  {r.puedePdf ? (
                    <a
                      href={`/api/pedidos/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "sm" }),
                        "inline-flex h-8 items-center"
                      )}
                    >
                      PDF
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                {puedeGestionarBandeja ? (
                  <td className="px-3 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex justify-end">
                      <PedidoBandejaListoButton pedidoId={r.id} listo={r.bandejaListo} />
                    </div>
                  </td>
                ) : null}
                <td className="px-3 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/postas/${r.postaId}/pedidos?ym=${ymPedido(r.anio, r.mes)}&from=admin`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                    >
                      Ver
                    </Link>
                    {puedeGestionarBandeja ? (
                      <AprobarPedidoButton pedidoId={r.id} estado={r.estado} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog.Root
        open={modalAbierto}
        onOpenChange={(open) => {
          setModalAbierto(open);
          if (!open) setSeleccion(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/50 transition-opacity",
              "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
            )}
          />
          <Dialog.Viewport
            className={cn(
              "fixed inset-0 z-50 flex max-h-[100dvh] max-w-[100vw] items-center justify-center p-3 outline-none sm:p-6"
            )}
          >
            <Dialog.Popup
              className={cn(
                "flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl outline-none"
              )}
            >
              {seleccion ? (
                <>
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3 sm:px-5">
                    <div className="min-w-0 space-y-1">
                      <Dialog.Title className="font-heading text-lg font-semibold tracking-tight text-foreground">
                        Pedido · {seleccion.mesTitulo}
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-muted-foreground">
                        {seleccion.postaNombre}
                        {seleccion.postaCodigo ? ` · código ${seleccion.postaCodigo}` : null}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close
                      type="button"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 shrink-0 gap-1")}
                      aria-label="Cerrar"
                    >
                      <X className="size-4" aria-hidden />
                    </Dialog.Close>
                  </div>

                  <div className="space-y-3 px-4 py-4 text-sm sm:px-5">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                      <dt className="text-muted-foreground">Estado</dt>
                      <dd
                        className={cn(
                          "text-xs",
                          seleccion.bandejaListo ? "font-mono" : "font-medium text-foreground"
                        )}
                      >
                        {etiquetaEstadoAdmin(seleccion)}
                      </dd>
                      <dt className="text-muted-foreground">Enviado</dt>
                      <dd>{seleccion.enviadoEtiqueta}</dd>
                      <dt className="text-muted-foreground">Bandeja</dt>
                      <dd>{seleccion.pendienteBandeja ? "Pendiente seguimiento" : "—"}</dd>
                      <dt className="text-muted-foreground">Listo admin</dt>
                      <dd>{seleccion.bandejaListo ? "Sí" : "No"}</dd>
                      <dt className="text-muted-foreground">ID</dt>
                      <dd className="break-all font-mono text-[11px]">{seleccion.id}</dd>
                    </dl>

                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5"
                        disabled={exportando}
                        onClick={() => void exportarExcelSeleccion()}
                      >
                        <FileSpreadsheet className="size-3.5" aria-hidden />
                        {exportando ? "Generando…" : "Exportar Excel"}
                      </Button>
                      {seleccion.puedePdf ? (
                        <a
                          href={`/api/pedidos/${seleccion.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "inline-flex h-8 items-center"
                          )}
                        >
                          PDF
                        </a>
                      ) : null}
                      <Link
                        href={`/postas/${seleccion.postaId}/pedidos?ym=${ymPedido(seleccion.anio, seleccion.mes)}&from=admin`}
                        className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8")}
                      >
                        Ver en posta
                      </Link>
                    </div>
                  </div>
                </>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
