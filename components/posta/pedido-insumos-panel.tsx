"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  enviarPedidoInsumosAction,
  type PedidoInsumosActionState,
} from "@/app/actions/pedido-insumos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import { PedidoEstadoBadge } from "@/components/posta/pedido-estado-badge";
import { cn } from "@/lib/utils";

export type PedidoInsumosLineaCliente = {
  insumoId: string;
  nombre: string;
  stock_objetivo: number;
  stock_actual: number;
  /** Si el stock actual proviene de un registro previo (dashboard u observación). */
  stock_conocido: boolean;
  cantidad_sugerida: number;
  cantidad_pedido: number;
};

type EstadoPedido =
  | "BORRADOR"
  | "ENVIADO"
  | "APROBADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "DESPACHADO"
  | "RECIBIDO"
  | null;

type Props = {
  postaId: string;
  pedidoId: string | null;
  estado: EstadoPedido;
  enviadoEtiqueta: string | null;
  comentarioAdmin: string | null;
  puedeEditar: boolean;
  lineas: PedidoInsumosLineaCliente[];
};

const INICIAL: PedidoInsumosActionState = {};

function calcularCantidad(objetivo: number, actual: number): number {
  return Math.max(0, objetivo - actual);
}

function leerCantidadInput(raw: string | null, fallback: number): number {
  const t = (raw ?? "").trim();
  if (t === "") return fallback;
  const n = Number.parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

type ValoresLinea = { actual: string; pedir: string; pedirManual: boolean };

function InputCantidad({
  id,
  name,
  value,
  disabled,
  onChange,
  placeholder,
}: {
  id?: string;
  name: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="number"
      min={0}
      step={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder ?? "0"}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm tabular-nums",
        "focus:outline-none focus:ring-2 focus:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    />
  );
}

export function PedidoInsumosPanel({
  postaId,
  pedidoId: pedidoIdProp,
  estado,
  enviadoEtiqueta,
  comentarioAdmin,
  puedeEditar,
  lineas,
}: Props) {
  const { toast } = useToast();

  const enviarAction = enviarPedidoInsumosAction.bind(null, postaId);

  const [stateEnviar, dispatchEnviar, pendingEnviar] = useActionState(enviarAction, INICIAL);

  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [valores, setValores] = useState<Map<string, ValoresLinea>>(() => {
    const m = new Map<string, ValoresLinea>();
    for (const l of lineas) {
      const tieneActual = l.stock_conocido || l.stock_actual > 0;
      const actualStr = tieneActual ? String(l.stock_actual) : "";
      const pedirManual =
        tieneActual && l.cantidad_pedido !== l.cantidad_sugerida;
      m.set(l.insumoId, {
        actual: actualStr,
        pedir: tieneActual ? String(l.cantidad_pedido) : "",
        pedirManual,
      });
    }
    return m;
  });

  useEffect(() => {
    if (stateEnviar.ok && stateEnviar.success) {
      toast(stateEnviar.success, "success");
      setConfirmOpen(false);
      setConfirmChecked(false);
    } else if (stateEnviar.error) {
      toast(stateEnviar.error, "error");
    }
  }, [stateEnviar, toast]);

  useEffect(() => {
    if (!confirmOpen) setConfirmChecked(false);
  }, [confirmOpen]);

  const setStockActual = (insumoId: string, v: string) => {
    setValores((prev) => {
      const next = new Map(prev);
      const linea = lineas.find((l) => l.insumoId === insumoId);
      const current = prev.get(insumoId) ?? { actual: "", pedir: "", pedirManual: false };
      const act = Number.parseInt(v, 10);
      const actVal = Number.isNaN(act) || act < 0 ? 0 : act;
      const sugerida = calcularCantidad(linea?.stock_objetivo ?? 0, actVal);
      if (v.trim() === "") {
        next.set(insumoId, { actual: v, pedir: "", pedirManual: false });
        return next;
      }
      const pedir = current.pedirManual ? current.pedir : String(sugerida);
      next.set(insumoId, { actual: v, pedir, pedirManual: current.pedirManual });
      return next;
    });
  };

  const setCantidadPedir = (insumoId: string, v: string) => {
    setValores((prev) => {
      const next = new Map(prev);
      const current = prev.get(insumoId) ?? { actual: "", pedir: "", pedirManual: false };
      next.set(insumoId, { ...current, pedir: v, pedirManual: true });
      return next;
    });
  };

  const cantidades = lineas.map((l) => {
    const v = valores.get(l.insumoId) ?? { actual: "", pedir: "", pedirManual: false };
    const act = Number.parseInt(v.actual, 10);
    const actVal = Number.isNaN(act) || act < 0 ? 0 : act;
    const sugerida = calcularCantidad(l.stock_objetivo, actVal);
    const aPedir = leerCantidadInput(v.pedir, sugerida);
    return { ...l, sugerida, aPedir, pedirManual: v.pedirManual };
  });

  const totalPedido = cantidades.reduce((a, l) => a + l.aPedir, 0);
  const lineasConPedido = cantidades.filter((l) => l.aPedir > 0);
  const insumoIdsJson = JSON.stringify(lineas.map((l) => l.insumoId));

  function abrirConfirmacionEnvio() {
    const sinStockActual = cantidades.filter((l) => {
      const raw = valores.get(l.insumoId)?.actual ?? "";
      return raw.trim() === "";
    });
    if (sinStockActual.length > 0) {
      toast("Ingresa el stock actual de todos los insumos antes de enviar.", "error");
      return;
    }
    setConfirmOpen(true);
  }

  function confirmarYEnviar() {
    const form = formRef.current;
    if (!form || !confirmChecked) return;
    const fd = new FormData(form);
    fd.set("_intent", "enviar");
    dispatchEnviar(fd);
  }

  const esEditable =
    puedeEditar && (estado === "OBSERVADO" || estado === null || estado === "RECHAZADO" || estado === "RECIBIDO");
  const enviado = estado === "ENVIADO" || estado === "APROBADO" || estado === "DESPACHADO";
  const rechazado = estado === "RECHAZADO";
  const recibido = estado === "RECIBIDO";

  const etiquetaEstado: Record<Exclude<EstadoPedido, null>, string> = {
    BORRADOR: "Pendiente",
    ENVIADO: "Enviado a administración",
    OBSERVADO: "Con observación — puedes corregirlo",
    APROBADO: "Aprobado",
    RECHAZADO: "Rechazado",
    DESPACHADO: "Despachado",
    RECIBIDO: "Recibido",
  };

  if (lineas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay insumos activos en el catálogo. Pide a administración que agregue insumos.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="insumo_ids_json" value={insumoIdsJson} />
        <input type="hidden" name="_intent" value="enviar" />

        {/* Estado actual */}
        {estado ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Estado del pedido:</span>
            <PedidoEstadoBadge estado={estado} />
            <span className="text-sm text-muted-foreground">{etiquetaEstado[estado]}</span>
            {enviadoEtiqueta ? (
              <span className="ml-auto text-xs text-muted-foreground">Enviado: {enviadoEtiqueta}</span>
            ) : null}
          </div>
        ) : null}

        {/* Observación del admin */}
        {comentarioAdmin && (estado === "OBSERVADO" || estado === "RECHAZADO") ? (
          <div className="rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-600/30 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-medium mb-1">Comentario de administración:</p>
            <p>{comentarioAdmin}</p>
          </div>
        ) : null}

        {rechazado ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            El pedido anterior fue rechazado. Completa el formulario y envía uno nuevo.
          </div>
        ) : null}

        {recibido ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-600/30 dark:bg-emerald-950/20 dark:text-emerald-100">
            El último pedido fue recibido. Puedes enviar un nuevo pedido cuando lo necesites.
          </div>
        ) : null}

        {/* Tabla de insumos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Insumos</CardTitle>
            {esEditable ? (
              <p className="text-xs text-muted-foreground mt-1">
                Ingresa el stock actual; la columna Sugerida se calcula sola y el campo Pedido viene
                precargado (puedes ajustarlo).
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Insumo</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                      Stock a manejar
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                      Stock actual
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                      Sugerida
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium text-foreground">
                      Pedido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cantidades.map((l, i) => {
                    const v = valores.get(l.insumoId) ?? { actual: "", pedir: "", pedirManual: false };
                    const necesita = l.aPedir > 0;
                    return (
                      <tr
                        key={l.insumoId}
                        className={cn(
                          "border-b border-border last:border-b-0",
                          i % 2 === 0 ? "bg-background" : "bg-muted/20",
                          necesita && esEditable ? "bg-amber-400/10 dark:bg-amber-500/8" : ""
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium leading-snug">{l.nombre}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-block min-w-[2.5rem] rounded-md bg-muted/60 px-2 py-1 font-semibold tabular-nums text-sm">
                            {l.stock_objetivo}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <InputCantidad
                            name={`actual_${l.insumoId}`}
                            value={v.actual}
                            disabled={!esEditable}
                            onChange={(val) => setStockActual(l.insumoId, val)}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
                          {v.actual.trim() !== "" ? l.sugerida : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {esEditable ? (
                            <InputCantidad
                              name={`pedir_${l.insumoId}`}
                              value={v.pedir}
                              disabled={!esEditable || v.actual.trim() === ""}
                              onChange={(val) => setCantidadPedir(l.insumoId, val)}
                            />
                          ) : (
                            <span
                              className={cn(
                                "inline-block min-w-[2.5rem] rounded-md px-2 py-1 text-center font-semibold tabular-nums text-sm",
                                l.aPedir > 0 ? "bg-primary/15 text-primary" : "text-muted-foreground"
                              )}
                            >
                              {l.aPedir}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/40">
                    <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">
                      Total pedido:
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-bold tabular-nums text-foreground">{totalPedido}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2 p-4">
              {cantidades.map((l) => {
                const v = valores.get(l.insumoId) ?? { actual: "", pedir: "", pedirManual: false };
                return (
                  <div
                    key={l.insumoId}
                    className={cn(
                      "rounded-lg border border-border p-3",
                      l.aPedir > 0 && esEditable ? "border-amber-400/50 bg-amber-400/10" : "bg-muted/20"
                    )}
                  >
                    <p className="font-medium leading-snug mb-2">{l.nombre}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">A manejar</p>
                        <span className="inline-block rounded-md bg-muted/60 px-2 py-1 font-semibold tabular-nums text-sm">
                          {l.stock_objetivo}
                        </span>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Actual</label>
                        <InputCantidad
                          name={`actual_${l.insumoId}`}
                          value={v.actual}
                          disabled={!esEditable}
                          onChange={(val) => setStockActual(l.insumoId, val)}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Sugerida</p>
                        <span className="inline-block rounded-md px-2 py-1 font-semibold tabular-nums text-sm text-muted-foreground">
                          {v.actual.trim() !== "" ? l.sugerida : "—"}
                        </span>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Pedido</label>
                        {esEditable ? (
                          <InputCantidad
                            name={`pedir_${l.insumoId}`}
                            value={v.pedir}
                            disabled={!esEditable || v.actual.trim() === ""}
                            onChange={(val) => setCantidadPedir(l.insumoId, val)}
                          />
                        ) : (
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-1 font-semibold tabular-nums text-sm",
                              l.aPedir > 0 ? "bg-primary/15 text-primary" : "text-muted-foreground"
                            )}
                          >
                            {l.aPedir}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total pedido:</span>
                <span className="font-bold tabular-nums">{totalPedido}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        {esEditable ? (
          <div className="flex flex-wrap items-center gap-3 justify-end pt-2">
            <Button
              type="button"
              disabled={pendingEnviar}
              onClick={abrirConfirmacionEnvio}
            >
              Enviar pedido…
            </Button>
          </div>
        ) : null}

        {enviado && !puedeEditar ? (
          <p className="text-sm text-muted-foreground text-right">
            Solo el encargado de la posta puede editar el pedido de insumos.
          </p>
        ) : null}
      </form>

      {/* Diálogo de confirmación de envío — obligatorio antes de enviar */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar pedido de insumos</DialogTitle>
            <DialogDescription>
              Revisa el resumen antes de enviar a administración. Una vez enviado, no podrás
              editarlo hasta que administración lo observe.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Insumo</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">A manejar</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Actual</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Sugerida</th>
                  <th className="px-3 py-2 text-center font-medium text-foreground">Pedido</th>
                </tr>
              </thead>
              <tbody>
                {cantidades.map((l, i) => {
                  const actRaw = valores.get(l.insumoId)?.actual ?? "";
                  const actVal = Number.parseInt(actRaw, 10);
                  return (
                    <tr
                      key={l.insumoId}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20",
                        l.aPedir > 0 ? "bg-primary/5" : ""
                      )}
                    >
                      <td className="px-3 py-1.5 font-medium">{l.nombre}</td>
                      <td className="px-3 py-1.5 text-center tabular-nums">{l.stock_objetivo}</td>
                      <td className="px-3 py-1.5 text-center tabular-nums">
                        {actRaw.trim() === "" ? "—" : Number.isNaN(actVal) ? 0 : actVal}
                      </td>
                      <td className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">
                        {actRaw.trim() !== "" ? l.sugerida : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-center font-semibold tabular-nums",
                          l.aPedir > 0 ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {l.aPedir}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40">
                  <td colSpan={4} className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Total pedido:
                  </td>
                  <td className="px-3 py-2 text-center font-bold tabular-nums">{totalPedido}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totalPedido === 0 ? (
            <p className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-600/30 dark:bg-amber-950/20 dark:text-amber-100">
              No hay unidades a pedir. Si envías igual, administración recibirá un pedido vacío.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {lineasConPedido.length} insumo{lineasConPedido.length !== 1 ? "s" : ""} con cantidad
              a pedir.
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            />
            <span>Confirmo que revisé el stock actual, las cantidades sugeridas y el pedido.</span>
          </label>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pendingEnviar}
            >
              Cancelar
            </Button>
            <Button disabled={pendingEnviar || !confirmChecked} onClick={confirmarYEnviar}>
              {pendingEnviar ? "Enviando…" : "Confirmar y enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
