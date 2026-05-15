"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type FormEvent, useActionState, useEffect } from "react";

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

type Props = {
  postaId: string;
  anio: number;
  mes: number;
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

export function PedidoMensualPanel({
  postaId,
  anio,
  mes,
  ymQuery,
  pedidoId,
  estado,
  enviadoEtiqueta,
  puedeEditar,
  lineas,
}: Props) {
  const router = useRouter();
  const bound = pedidoMensualSubmitAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PedidoMensualActionState, fd: FormData) => Promise<PedidoMensualActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const soloLectura =
    !puedeEditar ||
    estado === "ENVIADO" ||
    estado === "APROBADO" ||
    estado === "RECHAZADO" ||
    estado === "DESPACHADO" ||
    estado === "RECIBIDO";
  const puedePdf = Boolean(pedidoId) && estado !== "BORRADOR" && estado !== null;

  function antesDeEnviarPedido(e: FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const intent =
      submitter instanceof HTMLButtonElement &&
      submitter.name === "_intent" &&
      (submitter.value === "enviar" || submitter.value === "guardar")
        ? submitter.value
        : null;
    if (intent !== "enviar") return;
    const ok = window.confirm(
      "¿Enviar el pedido a administración? Después no podrás editar las cantidades acá."
    );
    if (!ok) e.preventDefault();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="text-lg">Líneas y stock</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            El disponible viene del registro del mes. La columna{" "}
            <strong className="text-foreground">Sugerida</strong> es{" "}
            <span className="font-mono text-xs">max(0, stock ref. − disponible)</span>. Puedes ajustar la columna{" "}
            <strong className="text-foreground">Pedido</strong> y guardar borrador o enviar a administración.
          </p>
          {estado ? (
            <p className="mt-2 text-xs font-mono text-muted-foreground">
              Estado: {estado}
              {enviadoEtiqueta ? ` · Enviado: ${enviadoEtiqueta}` : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Todavía no hay pedido guardado para este mes.</p>
          )}
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
            <form action={formAction} className="space-y-4" onSubmit={antesDeEnviarPedido}>
              <input type="hidden" name="anio" value={anio} />
              <input type="hidden" name="mes" value={mes} />
              <input
                type="hidden"
                name="medicamento_ids_json"
                value={JSON.stringify(lineas.map((l) => l.medicamentoId))}
              />

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/80 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-2 py-2">Medicamento</th>
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
                              const tono = nivelStockListadoVisual(
                                m.disponible,
                                m.stock_critico,
                                m.stock_recomendado
                              );
                              const filaClass =
                                tono === "alerta"
                                  ? "bg-destructive/10 dark:bg-destructive/15"
                                  : tono === "regular"
                                    ? "bg-amber-400/14 dark:bg-amber-500/12"
                                    : "bg-emerald-500/10 dark:bg-emerald-500/10";
                              const claseDisponible =
                                tono === "alerta"
                                  ? "text-destructive"
                                  : tono === "regular"
                                    ? "text-amber-950 dark:text-amber-100"
                                    : "text-emerald-900 dark:text-emerald-100";
                              return (
                                <tr
                                  key={m.medicamentoId}
                                  className={cn(
                                    "border-b border-border/70",
                                    filaClass
                                  )}
                                >
                                  <td className="px-2 py-1.5 align-middle">
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
                  <Button type="submit" name="_intent" value="guardar" variant="outline" disabled={pending}>
                    {pending ? "Guardando…" : "Guardar borrador"}
                  </Button>
                  <Button type="submit" name="_intent" value="enviar" disabled={pending}>
                    {pending ? "Enviando…" : "Confirmar y enviar"}
                  </Button>
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
