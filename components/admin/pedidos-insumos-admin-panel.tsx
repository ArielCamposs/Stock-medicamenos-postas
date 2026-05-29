"use client";

import { useActionState, useEffect, useState } from "react";

import {
  cambiarEstadoPedidoInsumosAdminAction,
  type PedidoInsumosActionState,
} from "@/app/actions/pedido-insumos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { PedidoEstadoBadge } from "@/components/posta/pedido-estado-badge";
import { cn } from "@/lib/utils";

type EstadoPedido =
  | "BORRADOR"
  | "ENVIADO"
  | "APROBADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "DESPACHADO"
  | "RECIBIDO";

export type PedidoInsumosAdminRow = {
  id: string;
  posta_id: string;
  postaNombre: string;
  postaCodigo: string | null;
  estado: EstadoPedido;
  enviadoEtiqueta: string | null;
  creadoEtiqueta: string | null;
  comentarioAdmin: string | null;
  detalle: { insumoNombre: string; cantidad_pedido: number }[];
};

type Props = {
  pedidos: PedidoInsumosAdminRow[];
  puedeGestionar: boolean;
};

const INICIAL: PedidoInsumosActionState = {};

const TRANSICIONES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  ENVIADO: ["APROBADO", "OBSERVADO", "RECHAZADO"],
  OBSERVADO: ["APROBADO", "RECHAZADO"],
  APROBADO: ["DESPACHADO"],
  DESPACHADO: ["RECIBIDO"],
};

const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  OBSERVADO: "Con observación",
  RECHAZADO: "Rechazado",
  DESPACHADO: "Despachado",
  RECIBIDO: "Recibido",
};

const GRUPOS_ESTADO: { label: string; estados: EstadoPedido[] }[] = [
  { label: "Pendientes", estados: ["ENVIADO", "OBSERVADO"] },
  { label: "Procesados", estados: ["APROBADO", "DESPACHADO"] },
  { label: "Finalizados", estados: ["RECIBIDO", "RECHAZADO"] },
];

function totalUnidades(detalle: { cantidad_pedido: number }[]): number {
  return detalle.reduce((a, d) => a + d.cantidad_pedido, 0);
}

type DialogState = {
  pedidoId: string;
  estadoNuevo: EstadoPedido;
  postaNombre: string;
} | null;

export function PedidosInsumosAdminPanel({ pedidos, puedeGestionar }: Props) {
  const { toast } = useToast();

  const [state, dispatch, pending] = useActionState(cambiarEstadoPedidoInsumosAdminAction, INICIAL);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [comentario, setComentario] = useState("");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state.ok) {
      toast(state.success ?? "Estado actualizado.", "success");
      setDialogState(null);
      setComentario("");
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state, toast]);

  function toggleExpandido(id: string) {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrirCambioEstado(pedidoId: string, estadoNuevo: EstadoPedido, postaNombre: string) {
    setComentario("");
    setDialogState({ pedidoId, estadoNuevo, postaNombre });
  }

  function confirmarCambioEstado() {
    if (!dialogState) return;
    const fd = new FormData();
    fd.set("pedido_id", dialogState.pedidoId);
    fd.set("estado", dialogState.estadoNuevo);
    if (comentario.trim()) fd.set("comentario_admin", comentario);
    dispatch(fd);
  }

  if (pedidos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay pedidos de insumos registrados todavía.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {GRUPOS_ESTADO.map(({ label, estados }) => {
          const grupo = pedidos.filter((p) => estados.includes(p.estado));
          if (grupo.length === 0) return null;
          return (
            <section key={label}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {label} ({grupo.length})
              </h2>
              <div className="space-y-3">
                {grupo.map((p) => {
                  const exp = expandido.has(p.id);
                  const transiciones = puedeGestionar ? (TRANSICIONES[p.estado] ?? []) : [];
                  const total = totalUnidades(p.detalle);
                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start gap-3 justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <CardTitle className="text-base font-semibold">
                                {p.postaNombre}
                              </CardTitle>
                              {p.postaCodigo ? (
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {p.postaCodigo}
                                </Badge>
                              ) : null}
                              <PedidoEstadoBadge estado={p.estado} />
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                              {p.creadoEtiqueta ? <span>Creado: {p.creadoEtiqueta}</span> : null}
                              {p.enviadoEtiqueta ? <span>Enviado: {p.enviadoEtiqueta}</span> : null}
                              <span>
                                {p.detalle.length} insumo{p.detalle.length !== 1 ? "s" : ""} ·{" "}
                                {total} unidades
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => toggleExpandido(p.id)}
                            >
                              {exp ? "Ocultar detalle" : "Ver detalle"}
                            </Button>
                            {transiciones.map((est) => (
                              <Button
                                key={est}
                                size="sm"
                                variant={
                                  est === "RECHAZADO"
                                    ? "destructive"
                                    : est === "OBSERVADO"
                                      ? "outline"
                                      : "default"
                                }
                                className="text-xs h-7"
                                onClick={() => abrirCambioEstado(p.id, est, p.postaNombre)}
                              >
                                {ETIQUETA_ESTADO[est]}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardHeader>

                      {exp ? (
                        <CardContent className="pt-0 pb-4">
                          {p.comentarioAdmin ? (
                            <div className="mb-3 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-600/30 dark:bg-amber-950/20 dark:text-amber-100">
                              <span className="font-medium">Comentario admin: </span>
                              {p.comentarioAdmin}
                            </div>
                          ) : null}
                          {p.detalle.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin detalle guardado.</p>
                          ) : (
                            <div className="rounded-md border border-border overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border bg-muted/50">
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                      Insumo
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                                      Cantidad pedida
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.detalle.map((d, i) => (
                                    <tr
                                      key={`${d.insumoNombre}-${i}`}
                                      className={cn(
                                        "border-b border-border last:border-b-0",
                                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                                      )}
                                    >
                                      <td className="px-3 py-1.5">{d.insumoNombre}</td>
                                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                                        {d.cantidad_pedido}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-border bg-muted/40">
                                    <td className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                                      Total:
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                                      {total}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Dialog confirmación cambio de estado */}
      <Dialog open={dialogState !== null} onOpenChange={(open) => { if (!open) setDialogState(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cambiar estado a {dialogState ? ETIQUETA_ESTADO[dialogState.estadoNuevo] : ""}
            </DialogTitle>
          </DialogHeader>
          {dialogState ? (
            <div className="space-y-3 text-sm">
              <p>
                Pedido de insumos de{" "}
                <strong>{dialogState.postaNombre}</strong> → estado{" "}
                <strong>{ETIQUETA_ESTADO[dialogState.estadoNuevo]}</strong>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="comentario-admin">
                  Comentario{" "}
                  {dialogState.estadoNuevo === "OBSERVADO" || dialogState.estadoNuevo === "RECHAZADO"
                    ? "(recomendado)"
                    : "(opcional)"}
                </Label>
                <textarea
                  id="comentario-admin"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Escribe una observación para la posta…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogState(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              variant={
                dialogState?.estadoNuevo === "RECHAZADO" ? "destructive" : "default"
              }
              disabled={pending}
              onClick={confirmarCambioEstado}
            >
              {pending ? "Actualizando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
