"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileDown, Package, Pill } from "lucide-react";

import { PedidoEstadoBadge } from "@/components/posta/pedido-estado-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  rangoFechasFiltroHistorialBodega,
  type BodegaDespachoFila,
  type BodegaPostaOpcion,
} from "@/lib/bodega/vista-despachos";
import { cn } from "@/lib/utils";

type Props = {
  filas: BodegaDespachoFila[];
  postas: BodegaPostaOpcion[];
};

function filaCoincideFiltros(
  f: BodegaDespachoFila,
  desde: string,
  hasta: string,
  postaId: string
): boolean {
  if (postaId && f.postaId !== postaId) return false;
  const d = f.fechaDespachoCalendario;
  if (!d) return false;
  if (desde && d < desde) return false;
  if (hasta && d > hasta) return false;
  return true;
}

function etiquetaTipoPedido(f: BodegaDespachoFila) {
  if (f.tipo === "insumos") return "Insumos";
  return f.pedidoTipo === "CONTRA_RECETA" ? "Medicamentos · contra receta" : "Medicamentos · general";
}

export function BodegaHistorialDespachos({ filas, postas }: Props) {
  const defecto = useMemo(() => rangoFechasFiltroHistorialBodega(), []);
  const [fechaDesde, setFechaDesde] = useState(defecto.desde);
  const [fechaHasta, setFechaHasta] = useState(defecto.hasta);
  const [postaId, setPostaId] = useState("");

  const filtradas = useMemo(
    () => filas.filter((f) => filaCoincideFiltros(f, fechaDesde, fechaHasta, postaId)),
    [filas, fechaDesde, fechaHasta, postaId]
  );

  const totalUnidades = useMemo(
    () => filtradas.reduce((a, f) => a + f.totalUnidades, 0),
    [filtradas]
  );

  function limpiarFiltros() {
    setFechaDesde(defecto.desde);
    setFechaHasta(defecto.hasta);
    setPostaId("");
  }

  return (
    <section className="space-y-4 border-t border-border/60 pt-8">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Historial de despachos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los pedidos que salieron de bodega (últimos 12 meses). Filtra por fecha de despacho y
          posta.
        </p>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="hist-desde" className="text-xs">
              Desde
            </Label>
            <Input
              id="hist-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hist-hasta" className="text-xs">
              Hasta
            </Label>
            <Input
              id="hist-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hist-posta" className="text-xs">
              Posta
            </Label>
            <select
              id="hist-posta"
              value={postaId}
              onChange={(e) => setPostaId(e.target.value)}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring/50"
              )}
            >
              <option value="">Todas las postas</option>
              {postas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.codigo ? ` (${p.codigo})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{filtradas.length}</span> despacho
            {filtradas.length === 1 ? "" : "s"}
            {filtradas.length > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-foreground">{totalUnidades}</span> unidades
              </>
            ) : null}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>
            Restablecer filtros
          </Button>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Aún no hay despachos registrados en el último año.
        </p>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay despachos con los filtros seleccionados. Prueba ampliar el rango de fechas o elegir
          otra posta.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                    Despachado
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Posta</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Pedido</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                    Unidades
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f, i) => (
                  <tr
                    key={`${f.tipo}-${f.id}`}
                    className={cn(
                      "border-b border-border last:border-b-0",
                      i % 2 === 0 ? "bg-background" : "bg-muted/15"
                    )}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-xs">
                      {f.despachadoEtiqueta}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{f.postaNombre}</span>
                      {f.postaCodigo ? (
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                          {f.postaCodigo}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {f.tipo === "medicamentos" ? (
                          <Pill className="size-3.5 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <Package className="size-3.5 shrink-0 text-primary" aria-hidden />
                        )}
                        {etiquetaTipoPedido(f)}
                      </span>
                      <span className="block text-xs">{f.mesTitulo}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {f.totalUnidades}
                      <span className="block text-[10px] text-muted-foreground">
                        {f.nLineas} {f.nLineas === 1 ? "línea" : "líneas"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PedidoEstadoBadge estado={f.estado} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {f.tipo === "medicamentos" ? (
                        <Link
                          href={`/api/pedidos/${f.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
                        >
                          <FileDown className="size-3.5" aria-hidden />
                          PDF
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {filtradas.map((f) => (
              <li
                key={`m-${f.tipo}-${f.id}`}
                className="rounded-xl border border-border/80 bg-card px-4 py-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{f.postaNombre}</p>
                    {f.postaCodigo ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {f.postaCodigo}
                      </Badge>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{etiquetaTipoPedido(f)}</p>
                    <p className="text-xs text-muted-foreground">{f.mesTitulo}</p>
                    <p className="text-xs tabular-nums">
                      Despachado: {f.despachadoEtiqueta} · {f.totalUnidades} u.
                    </p>
                  </div>
                  <PedidoEstadoBadge estado={f.estado} />
                </div>
                {f.tipo === "medicamentos" ? (
                  <Link
                    href={`/api/pedidos/${f.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "mt-2 gap-1"
                    )}
                  >
                    <FileDown className="size-3.5" aria-hidden />
                    PDF
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
