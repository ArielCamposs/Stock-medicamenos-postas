"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AprobarPedidoButton } from "@/components/admin/aprobar-pedido-button";
import { PedidoBandejaListoButton } from "@/components/admin/pedido-bandeja-listo-button";
import { PedidoEstadoBadge } from "@/components/posta/pedido-estado-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { etiquetaPedidoEstado } from "@/lib/domain/pedido-estado-ui";
import type { PedidoMensualDetallePayload } from "@/lib/posta/pedido-mensual-detalle";
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
  tipo: "GENERAL" | "CONTRA_RECETA";
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

function filaAXlsxPayload(f: AdminPedidoTablaFila) {
  return {
    postaNombre: f.postaNombre,
    postaCodigo: f.postaCodigo,
    mesTitulo: f.mesTitulo,
    estado: etiquetaPedidoEstado(f.estado),
    enviadoEtiqueta: f.enviadoEtiqueta,
    pendienteBandeja: f.pendienteBandeja ? "Sí" : "No",
    bandejaListo: f.bandejaListo ? "Sí" : "No",
    pedidoId: f.id,
  };
}

function normalizaBusqueda(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function lineaCoincideBusqueda(
  nombre: string,
  codigo: string,
  q: string
): boolean {
  if (!q) return true;
  return (
    nombre.toLowerCase().includes(q) ||
    codigo.toLowerCase().includes(q)
  );
}

export function AdminPedidosHistorialInteractivo({ filas, puedeGestionarBandeja }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<AdminPedidoTablaFila | null>(null);
  const [exportando, setExportando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<PedidoMensualDetallePayload | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const cacheDetalleRef = useRef<Map<string, PedidoMensualDetallePayload>>(new Map());

  const queryBusqueda = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);

  const abrirPedido = useCallback((f: AdminPedidoTablaFila) => {
    setSeleccion(f);
    setBusqueda("");
    setModalAbierto(true);
  }, []);

  useEffect(() => {
    if (!modalAbierto || !seleccion) {
      setDetalle(null);
      setErrorDetalle(null);
      setCargandoDetalle(false);
      return;
    }

    const cached = cacheDetalleRef.current.get(seleccion.id);
    if (cached) {
      setDetalle(cached);
      setErrorDetalle(null);
      setCargandoDetalle(false);
      return;
    }

    let cancelado = false;
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setDetalle(null);

    void (async () => {
      try {
        const res = await fetch(`/api/pedidos/${seleccion.id}/detalle`, {
          credentials: "same-origin",
        });
        const body = (await res.json()) as PedidoMensualDetallePayload | { error?: string };
        if (cancelado) return;
        if (!res.ok) {
          setErrorDetalle(
            typeof body === "object" && body && "error" in body && typeof body.error === "string"
              ? body.error
              : "No se pudo cargar el detalle del pedido."
          );
          return;
        }
        const data = body as PedidoMensualDetallePayload;
        cacheDetalleRef.current.set(seleccion.id, data);
        setDetalle(data);
      } catch {
        if (!cancelado) {
          setErrorDetalle("Error de red al cargar el pedido.");
        }
      } finally {
        if (!cancelado) setCargandoDetalle(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [modalAbierto, seleccion]);

  const lineasVisibles = useMemo(() => {
    if (!detalle) return [];
    return detalle.lineas.filter((l) =>
      lineaCoincideBusqueda(l.nombre, l.codigo_interno, queryBusqueda)
    );
  }, [detalle, queryBusqueda]);

  const totalUnidadesVisibles = useMemo(
    () => lineasVisibles.reduce((acc, l) => acc + l.cantidad_final, 0),
    [lineasVisibles]
  );

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
              <th className="px-3 py-3 align-middle">Tipo</th>
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
                className={cn(
                  "border-b border-border/60 last:border-0 transition-colors",
                  r.bandejaListo && "bg-emerald-500/12 dark:bg-emerald-500/10",
                  !r.bandejaListo && r.pendienteBandeja && "bg-amber-500/10 dark:bg-amber-500/10"
                )}
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
                <td className="px-3 py-3 align-middle">
                  {r.tipo === "CONTRA_RECETA" ? (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      Contra receta
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">General</span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle capitalize">{r.mesTitulo}</td>
                <td className="px-3 py-3 align-middle">
                  <PedidoEstadoBadge estado={r.estado} />
                </td>
                <td className="px-3 py-3 align-middle text-muted-foreground">{r.enviadoEtiqueta}</td>
                <td className="px-3 py-3 align-middle text-right">
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
                  <td className="px-3 py-3 align-middle text-right">
                    <div className="inline-flex justify-end">
                      <PedidoBandejaListoButton pedidoId={r.id} listo={r.bandejaListo} />
                    </div>
                  </td>
                ) : null}
                <td className="px-3 py-3 align-middle text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => abrirPedido(r)}
                    >
                      Ver
                    </Button>
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
          if (!open) {
            setSeleccion(null);
            setBusqueda("");
          }
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
                "flex w-full max-w-4xl max-h-[min(92dvh,56rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl outline-none"
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

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                      <dt className="text-muted-foreground">Tipo</dt>
                      <dd>
                        {seleccion.tipo === "CONTRA_RECETA" ? (
                          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                            Contra receta
                          </span>
                        ) : (
                          <span>General</span>
                        )}
                      </dd>
                      <dt className="text-muted-foreground">Estado</dt>
                      <dd>
                        <PedidoEstadoBadge estado={seleccion.estado} />
                      </dd>
                      <dt className="text-muted-foreground">Enviado</dt>
                      <dd>{seleccion.enviadoEtiqueta}</dd>
                      {detalle ? (
                        <>
                          <dt className="text-muted-foreground">Medicamentos</dt>
                          <dd className="tabular-nums">
                            {detalle.nMedicamentos}{" "}
                            {detalle.nMedicamentos === 1 ? "línea" : "líneas"} ·{" "}
                            {detalle.totalUnidades} unidades
                          </dd>
                        </>
                      ) : null}
                    </dl>

                    {detalle?.comentarioAdmin ? (
                      <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-600/30 dark:bg-amber-950/20 dark:text-amber-100">
                        <span className="font-medium">Comentario admin: </span>
                        {detalle.comentarioAdmin}
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5" style={{ minWidth: "14rem" }}>
                          <Label htmlFor="admin-ped-buscar" className="text-xs font-medium">
                            Buscar medicamento
                          </Label>
                          <div className="relative">
                            <Search
                              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                              aria-hidden
                            />
                            <Input
                              id="admin-ped-buscar"
                              type="search"
                              autoComplete="off"
                              placeholder="Nombre o código interno…"
                              value={busqueda}
                              onChange={(e) => setBusqueda(e.target.value)}
                              className="pl-9"
                              disabled={cargandoDetalle || !detalle}
                            />
                          </div>
                        </div>
                        {detalle && queryBusqueda ? (
                          <p className="pb-2 text-xs text-muted-foreground">
                            {lineasVisibles.length === 0 ? (
                              <>Sin coincidencias.</>
                            ) : (
                              <>
                                <span className="font-medium text-foreground tabular-nums">
                                  {lineasVisibles.length}
                                </span>{" "}
                                de {detalle.lineas.length}{" "}
                                {detalle.lineas.length === 1 ? "medicamento" : "medicamentos"}
                              </>
                            )}
                          </p>
                        ) : null}
                      </div>

                      {cargandoDetalle ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Cargando detalle…
                        </div>
                      ) : errorDetalle ? (
                        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {errorDetalle}
                        </p>
                      ) : detalle && detalle.lineas.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Este pedido no tiene medicamentos con cantidad mayor que 0.
                        </p>
                      ) : detalle ? (
                        <>
                          <div className="hidden md:block overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[36rem] border-collapse text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                                  <th className="px-3 py-2.5">Medicamento</th>
                                  <th className="px-3 py-2.5">Código</th>
                                  <th className="px-3 py-2.5 text-right">Sugerida</th>
                                  <th className="px-3 py-2.5 text-right">Pedido</th>
                                  <th className="px-3 py-2.5">Unidad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lineasVisibles.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                                    >
                                      Sin coincidencias para la búsqueda.
                                    </td>
                                  </tr>
                                ) : (
                                  lineasVisibles.map((l, i) => (
                                    <tr
                                      key={l.medicamentoId}
                                      className={cn(
                                        "border-b border-border/60 last:border-0",
                                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                                      )}
                                    >
                                      <td className="px-3 py-2 font-medium">{l.nombre}</td>
                                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                        {l.codigo_interno}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                        {l.cantidad_sugerida}
                                      </td>
                                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                        {l.cantidad_final}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {l.unidad_medida || "—"}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              {lineasVisibles.length > 0 ? (
                                <tfoot>
                                  <tr className="border-t bg-muted/40 text-xs">
                                    <td
                                      colSpan={3}
                                      className="px-3 py-2 text-right font-medium text-muted-foreground"
                                    >
                                      {queryBusqueda ? "Total filtrado:" : "Total:"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                      {totalUnidadesVisibles}
                                    </td>
                                    <td />
                                  </tr>
                                </tfoot>
                              ) : null}
                            </table>
                          </div>

                          <div className="space-y-2 md:hidden">
                            {lineasVisibles.length === 0 ? (
                              <p className="py-6 text-center text-sm text-muted-foreground">
                                Sin coincidencias para la búsqueda.
                              </p>
                            ) : (
                              lineasVisibles.map((l) => (
                                <div
                                  key={l.medicamentoId}
                                  className="rounded-lg border border-border bg-card p-3 text-sm"
                                >
                                  <p className="font-medium leading-snug">{l.nombre}</p>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    {l.codigo_interno}
                                  </p>
                                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <dt className="text-muted-foreground">Sugerida</dt>
                                      <dd className="tabular-nums">{l.cantidad_sugerida}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Pedido</dt>
                                      <dd className="font-semibold tabular-nums">{l.cantidad_final}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Unidad</dt>
                                      <dd>{l.unidad_medida || "—"}</dd>
                                    </div>
                                  </dl>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 border-t bg-muted/20 px-4 py-3 sm:px-5">
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
                      href={`/postas/${seleccion.postaId}/pedidos?ym=${ymPedido(seleccion.anio, seleccion.mes)}&from=admin${seleccion.tipo === "CONTRA_RECETA" ? "&tab=contra-receta" : ""}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
                    >
                      Ver en posta
                    </Link>
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
