"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useActionState, useEffect, useRef, useState } from "react";

import {
  pedidoMensualSubmitAction,
  type PedidoMensualActionState,
} from "@/app/actions/pedido-mensual";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { StockNivelLeyenda } from "@/components/posta/stock-nivel-leyenda";
import {
  etiquetaMedicamentoCategoria,
  MEDICAMENTO_CATEGORIAS,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { nivelStockListadoVisual } from "@/lib/posta/admin-stock-alerta-postas";
import { cn } from "@/lib/utils";

export type PedidoMensualLineaCliente = {
  medicamentoId: string;
  nombre: string;
  codigo_interno: string;
  unidad_medida: string;
  categoria: MedicamentoCategoria;
  stock_recomendado: number;
  stock_critico: number;
  disponible: number;
  cantidad_sugerida: number;
  cantidad_final: number;
};

type LineaResumenEnvio = PedidoMensualLineaCliente & { cantidadPedido: number };

type Props = {
  postaId: string;
  anio: number;
  mes: number;
  mesTitulo: string;
  postaNombre: string | null;
  postaCodigo: string | null;
  ymQuery: string;
  pedidoId: string | null;
  estado:
    | "BORRADOR"
    | "ENVIADO"
    | "OBSERVADO"
    | "RECHAZADO"
    | "APROBADO"
    | "DESPACHADO"
    | "RECIBIDO"
    | null;
  /** Texto ya formateado en el servidor (evita hydration mismatch con `toLocaleString` en el cliente). */
  enviadoEtiqueta: string | null;
  puedeEditar: boolean;
  lineas: PedidoMensualLineaCliente[];
};

function leerCantidadInput(raw: string | null, fallback: number): number {
  const t = (raw ?? "").trim();
  if (t === "") return fallback;
  const n = Number.parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

function resumenDesdeFormulario(
  form: HTMLFormElement,
  lineas: PedidoMensualLineaCliente[]
): LineaResumenEnvio[] {
  const fd = new FormData(form);
  return lineas.map((l) => ({
    ...l,
    cantidadPedido: leerCantidadInput(
      fd.get(`final_${l.medicamentoId}`)?.toString() ?? null,
      l.cantidad_final
    ),
  }));
}

function armarResumenEnvio(lineas: LineaResumenEnvio[]) {
  const conPedido = lineas.filter((l) => l.cantidadPedido > 0);
  const totalUnidades = conPedido.reduce((acc, l) => acc + l.cantidadPedido, 0);
  return { conPedido, totalUnidades, nMedicamentos: conPedido.length };
}

function clasesFilaStock(
  disponible: number,
  stock_critico: number,
  stock_recomendado: number
) {
  const tono = nivelStockListadoVisual(disponible, stock_critico, stock_recomendado);
  return {
    filaClass:
      tono === "alerta"
        ? "bg-destructive/10 dark:bg-destructive/15 border-l-4 border-l-destructive"
        : tono === "regular"
          ? "bg-amber-400/14 dark:bg-amber-500/12 border-l-4 border-l-amber-500"
          : "bg-emerald-500/10 dark:bg-emerald-500/10 border-l-4 border-l-emerald-500",
    claseDisponible:
      tono === "alerta"
        ? "text-destructive"
        : tono === "regular"
          ? "text-amber-950 dark:text-amber-100"
          : "text-emerald-900 dark:text-emerald-100",
  };
}

function PedidoLineaMobileCard({
  m,
  soloLectura,
}: {
  m: PedidoMensualLineaCliente;
  soloLectura: boolean;
}) {
  const { filaClass, claseDisponible } = clasesFilaStock(
    m.disponible,
    m.stock_critico,
    m.stock_recomendado
  );
  return (
    <div className={cn("rounded-lg border border-border p-3", filaClass)}>
      <p className="font-medium leading-snug">{m.nombre}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{m.codigo_interno}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Disponible</dt>
          <dd className={cn("font-semibold tabular-nums", claseDisponible)}>{m.disponible}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sugerida</dt>
          <dd className="font-semibold tabular-nums">{m.cantidad_sugerida}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stock ref.</dt>
          <dd className="tabular-nums">{m.stock_recomendado}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Crítico</dt>
          <dd className="tabular-nums">{m.stock_critico}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Pedido</span>
        {soloLectura ? (
          <span className="text-lg font-semibold tabular-nums">{m.cantidad_final}</span>
        ) : (
          <input
            name={`final_${m.medicamentoId}`}
            type="number"
            min={0}
            step={1}
            defaultValue={m.cantidad_final}
            className="h-9 w-24 rounded-md border border-input bg-background px-2 text-right text-sm font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        )}
      </div>
    </div>
  );
}

export function PedidoMensualPanel({
  postaId,
  anio,
  mes,
  mesTitulo,
  postaNombre,
  postaCodigo,
  ymQuery,
  pedidoId,
  estado,
  enviadoEtiqueta,
  puedeEditar,
  lineas,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submitEnviarRef = useRef<HTMLButtonElement>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [resumenEnvio, setResumenEnvio] = useState<{
    conPedido: LineaResumenEnvio[];
    totalUnidades: number;
    nMedicamentos: number;
  } | null>(null);

  const bound = pedidoMensualSubmitAction.bind(null, postaId);
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(
    bound as (s: PedidoMensualActionState, fd: FormData) => Promise<PedidoMensualActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      setConfirmarAbierto(false);
      router.refresh();
    }
  }, [state.ok, router]);

  useEffect(() => {
    if (state.success) toast(state.success, "success");
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  const soloLectura =
    !puedeEditar ||
    estado === "ENVIADO" ||
    estado === "APROBADO" ||
    estado === "RECHAZADO" ||
    estado === "DESPACHADO" ||
    estado === "RECIBIDO";
  const puedePdf = Boolean(pedidoId) && estado !== "BORRADOR" && estado !== null;
  const esReenvioObservado = estado === "OBSERVADO";

  function abrirConfirmacionEnvio() {
    const form = formRef.current;
    if (!form) return;
    const lineasForm = resumenDesdeFormulario(form, lineas);
    setResumenEnvio(armarResumenEnvio(lineasForm));
    setConfirmarAbierto(true);
  }

  function confirmarEnvio() {
    submitEnviarRef.current?.click();
  }

  const resumen = resumenEnvio;
  const pedidoVacio = resumen !== null && resumen.nMedicamentos === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="text-lg">Líneas y stock</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            El disponible viene del registro del mes. Ajusta la columna{" "}
            <strong className="text-foreground">Pedido</strong> y envía a administración cuando esté listo.
            Sólo puedes enviar <strong className="text-foreground">UN PEDIDO</strong> por mes.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {estado ? (
              <>
                <PedidoEstadoBadge estado={estado} />
                {enviadoEtiqueta ? (
                  <span className="text-xs text-muted-foreground">
                    Enviado: {enviadoEtiqueta}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Todavía no hay pedido registrado para este mes.
              </span>
            )}
          </div>
          <StockNivelLeyenda className="mt-3" compact />
        </CardHeader>
        <CardContent className="pt-4">
          {state.error ? (
            <p
              className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p
              className="mb-3 rounded-md border border-emerald-600/35 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-50"
              role="status"
            >
              {state.success}
            </p>
          ) : null}

          {lineas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay medicamentos activos en el catálogo.</p>
          ) : (
            <form ref={formRef} action={formAction} className="space-y-4">
              <input type="hidden" name="anio" value={anio} />
              <input type="hidden" name="mes" value={mes} />
              <input
                type="hidden"
                name="medicamento_ids_json"
                value={JSON.stringify(lineas.map((l) => l.medicamentoId))}
              />

              <div className="space-y-4 lg:hidden">
                {MEDICAMENTO_CATEGORIAS.map((cat) => {
                  const lineasCat = lineas.filter((l) => l.categoria === cat);
                  if (lineasCat.length === 0) return null;
                  return (
                    <section key={`m-${cat}`} className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {etiquetaMedicamentoCategoria[cat]}
                      </h3>
                      <div className="space-y-2">
                        {lineasCat.map((m) => (
                          <PedidoLineaMobileCard
                            key={m.medicamentoId}
                            m={m}
                            soloLectura={soloLectura}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/80 text-left text-xs font-medium text-muted-foreground">
                      <th className="sticky left-0 z-10 min-w-[10rem] bg-muted/95 px-2 py-2 backdrop-blur">
                        Medicamento
                      </th>
                      <th className="px-2 py-2">Unidad</th>
                      <th className="px-2 py-2 text-right">Stock ref.</th>
                      <th className="px-2 py-2 text-right">Crítico</th>
                      <th className="px-2 py-2 text-right">Disponible</th>
                      <th className="px-2 py-2 text-right">Sugerida</th>
                      <th className="px-2 py-2 text-right">Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      return MEDICAMENTO_CATEGORIAS.map((cat) => {
                        const lineasCat = lineas.filter((l) => l.categoria === cat);
                        if (lineasCat.length === 0) return null;
                        return (
                          <Fragment key={cat}>
                            <tr className="border-b border-border bg-muted/80">
                              <td
                                colSpan={7}
                                className="px-2 py-2 text-xs font-semibold tracking-wide text-foreground"
                              >
                                {etiquetaMedicamentoCategoria[cat]}
                              </td>
                            </tr>
                            {lineasCat.map((m) => {
                              const { filaClass, claseDisponible } = clasesFilaStock(
                                m.disponible,
                                m.stock_critico,
                                m.stock_recomendado
                              );
                              return (
                                <tr
                                  key={m.medicamentoId}
                                  className={cn(
                                    "border-b border-border/70",
                                    filaClass
                                  )}
                                >
                                  <td className="sticky left-0 z-[1] min-w-[10rem] bg-inherit px-2 py-1.5 align-middle shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                      <span className="font-medium leading-snug">
                                        {m.nombre}
                                      </span>
                                      <span className="font-mono text-[11px] text-muted-foreground">
                                        {m.codigo_interno}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 text-muted-foreground">
                                    {m.unidad_medida}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {m.stock_recomendado}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {m.stock_critico}
                                  </td>
                                  <td
                                    className={cn(
                                      "px-2 py-1.5 text-right font-medium tabular-nums",
                                      claseDisponible
                                    )}
                                  >
                                    {m.disponible}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                    {m.cantidad_sugerida}
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    {soloLectura ? (
                                      <span className="font-medium tabular-nums">
                                        {m.cantidad_final}
                                      </span>
                                    ) : (
                                      <input
                                        name={`final_${m.medicamentoId}`}
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={m.cantidad_final}
                                        className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {!soloLectura ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={abrirConfirmacionEnvio}
                  >
                    {pending ? "Enviando…" : "Confirmar y enviar"}
                  </Button>
                  <button
                    ref={submitEnviarRef}
                    type="submit"
                    name="_intent"
                    value="enviar"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                  >
                    Enviar
                  </button>
                </div>
              ) : puedePdf ? (
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/api/pedidos/${pedidoId}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "secondary" }), "inline-flex h-9 items-center")}
                  >
                    Descargar PDF
                  </a>
                </div>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmarAbierto} onOpenChange={setConfirmarAbierto}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {esReenvioObservado ? "Reenviar pedido corregido" : "Enviar pedido a administración"}
            </DialogTitle>
            <DialogDescription>
              Revisa el resumen del pedido antes de confirmar el envío.
            </DialogDescription>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium capitalize text-foreground">{mesTitulo}</span>
                  {postaNombre ? (
                    <>
                      {" "}
                      · <span className="text-foreground">{postaNombre}</span>
                      {postaCodigo ? (
                        <span className="font-mono text-xs"> ({postaCodigo})</span>
                      ) : null}
                    </>
                  ) : null}
              </div>
              {resumen ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
                    {resumen.nMedicamentos === 0 ? (
                      <>
                        Todas las líneas quedan en <strong>0</strong>. ¿Quieres enviar igual un pedido sin
                        cantidades?
                      </>
                    ) : (
                      <>
                        Vas a pedir{" "}
                        <strong className="tabular-nums">
                          {resumen.totalUnidades.toLocaleString("es-CL")}
                        </strong>{" "}
                        unidades en{" "}
                        <strong className="tabular-nums">{resumen.nMedicamentos}</strong>{" "}
                        {resumen.nMedicamentos === 1 ? "medicamento" : "medicamentos"}.
                      </>
                    )}
                </div>
              ) : null}
                {resumen && resumen.conPedido.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                    <ul className="divide-y divide-border text-xs">
                      {resumen.conPedido.map((l) => (
                        <li
                          key={l.medicamentoId}
                          className="flex items-baseline justify-between gap-3 px-3 py-2"
                        >
                          <span className="min-w-0 truncate text-foreground">{l.nombre}</span>
                          <span className="shrink-0 tabular-nums font-medium text-foreground">
                            {l.cantidadPedido} {l.unidad_medida}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              <p className="text-xs">
                {esReenvioObservado
                  ? "Al reenviar, administración verá las cantidades actualizadas. No podrás editarlas acá hasta que vuelvan a observar el pedido."
                  : "Después del envío no podrás cambiar las cantidades desde esta pantalla. Revisa bien antes de confirmar."}
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmarAbierto(false)}
            >
              Volver a revisar
            </Button>
            <Button type="button" disabled={pending} onClick={confirmarEnvio}>
              {pending
                ? "Enviando…"
                : pedidoVacio
                  ? "Enviar pedido vacío"
                  : esReenvioObservado
                    ? "Reenviar pedido"
                    : "Enviar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/postas/${postaId}/descuento?ym=${ymQuery}`}
          className={cn(buttonVariants({ variant: "default" }), "w-fit")}
        >
          {puedeEditar ? "Ir a descuento" : "Ver descuento"}
        </Link>
        <Link
          href={`/postas/${postaId}/ingresos?ym=${ymQuery}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          {puedeEditar ? "Ir a ingresos" : "Ver ingresos"}
        </Link>
      </div>
    </div>
  );
}
