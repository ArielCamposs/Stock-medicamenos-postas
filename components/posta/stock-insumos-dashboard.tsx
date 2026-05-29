"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package, Search } from "lucide-react";

import {
  guardarStockInsumosPostaAction,
  type StockInsumosActionState,
} from "@/app/actions/stock-insumos";
import { useToast } from "@/components/providers/toast-provider";
import { StockNivelLeyenda } from "@/components/posta/stock-nivel-leyenda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NivelStockListadoVisual } from "@/lib/posta/admin-stock-alerta-postas";
import { cn } from "@/lib/utils";

export type FilaStockInsumoDashboard = {
  id: string;
  nombre: string;
  unidad: string;
  stockObjetivo: number;
  /** Cantidad guardada; `null` si nunca se registró. */
  cantidad: number | null;
  nivel: "critico" | "cerca" | null;
  tono: NivelStockListadoVisual;
};

const INICIAL: StockInsumosActionState = {};

const cantInputClass =
  "h-8 w-full min-w-0 max-w-[5rem] mx-auto rounded-lg border border-input bg-transparent px-2 py-1 text-center text-sm tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50";

export function StockInsumosDashboard({
  postaId,
  filas,
  puedeEditar,
  embebido = false,
}: {
  postaId: string;
  filas: FilaStockInsumoDashboard[];
  puedeEditar: boolean;
  embebido?: boolean;
}) {
  const { toast } = useToast();
  const bound = guardarStockInsumosPostaAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(bound, INICIAL);

  const [busqueda, setBusqueda] = useState("");
  const [valores, setValores] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const f of filas) {
      m.set(f.id, f.cantidad === null ? "" : String(f.cantidad));
    }
    return m;
  });

  useEffect(() => {
    if (state.ok && state.success) toast(state.success, "success");
    else if (state.error) toast(state.error, "error");
  }, [state, toast]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.nombre.toLowerCase().includes(q));
  }, [filas, busqueda]);

  const insumoIdsJson = useMemo(() => JSON.stringify(filas.map((f) => f.id)), [filas]);

  const nCritico = filas.filter((f) => f.nivel === "critico").length;
  const nCerca = filas.filter((f) => f.nivel === "cerca").length;
  const nSinRegistrar = filas.filter((f) => f.cantidad === null).length;

  const ordenTono = (f: FilaStockInsumoDashboard) => {
    if (f.tono === "alerta") return f.nivel === "critico" ? 0 : 1;
    if (f.tono === "regular") return 2;
    return 3;
  };

  const filasOrdenadas = useMemo(
    () =>
      [...filasFiltradas].sort((a, b) => {
        const ta = ordenTono(a) - ordenTono(b);
        if (ta !== 0) return ta;
        const ca = a.cantidad ?? -1;
        const cb = b.cantidad ?? -1;
        if (ca !== cb) return ca - cb;
        return a.nombre.localeCompare(b.nombre, "es-CL", { sensitivity: "base" });
      }),
    [filasFiltradas]
  );

  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        No hay insumos activos en el catálogo.
      </p>
    );
  }

  const encabezado = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {!embebido ? (
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Package className="size-4.5 text-primary" />
            Stock de insumos
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Registra cuánto queda de cada insumo para detectar los que están por agotarse.
          </CardDescription>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Registra el stock actual de cada insumo. Los que estén bajos se marcan en rojo o amarillo.
        </p>
      )}
      <StockNivelLeyenda className="shrink-0" compact />
    </div>
  );

  const alertas =
    nCritico > 0 || nCerca > 0 || nSinRegistrar > 0 ? (
      <div className="flex flex-wrap gap-2">
        {nCritico > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-3" />
            {nCritico} en crítico
          </span>
        ) : null}
        {nCerca > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            {nCerca} cerca del mínimo
          </span>
        ) : null}
        {nSinRegistrar > 0 ? (
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {nSinRegistrar} sin registrar
          </span>
        ) : null}
      </div>
    ) : null;

  const cuerpo = (
    <form action={formAction}>
      <input type="hidden" name="insumo_ids_json" value={insumoIdsJson} />
      {filasOrdenadas.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Sin resultados para &ldquo;{busqueda}&rdquo;.
        </p>
      ) : (
        <>
          <div className="hidden md:block max-h-[min(55vh,32rem)] overflow-auto">
            <table className="w-full min-w-[32rem] text-left text-sm border-collapse">
              <thead className="sticky top-0 z-20 border-b border-border/60 bg-muted/90 backdrop-blur-sm text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Insumo</th>
                  <th className="px-5 py-3 text-center">A manejar</th>
                  <th className="px-5 py-3 text-center">Stock actual</th>
                  <th className="px-5 py-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filasOrdenadas.map((f) => {
                  const val = valores.get(f.id) ?? "";
                  const maxVal = Math.max(f.stockObjetivo, f.cantidad ?? 0, 1);
                  const disp = f.cantidad ?? 0;
                  const pct = Math.min(100, Math.round((disp / maxVal) * 100));
                  const colorBarra =
                    f.tono === "alerta"
                      ? "bg-destructive"
                      : f.tono === "regular"
                        ? "bg-amber-500"
                        : "bg-emerald-500";
                  return (
                    <tr key={f.id} className="hover:bg-muted/25 transition-colors">
                      <td
                        className={cn(
                          "px-5 py-3 font-semibold border-l-4",
                          f.tono === "alerta"
                            ? "border-l-destructive"
                            : f.tono === "regular"
                              ? "border-l-amber-500"
                              : "border-l-emerald-500"
                        )}
                      >
                        {f.nombre}
                        {f.unidad ? (
                          <span className="ml-1.5 font-normal text-xs text-muted-foreground">
                            ({f.unidad})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-center tabular-nums text-muted-foreground">
                        {f.stockObjetivo.toLocaleString("es-CL")}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          name={`stock_${f.id}`}
                          value={val}
                          disabled={!puedeEditar || pending}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setValores((prev) => {
                              const next = new Map(prev);
                              next.set(f.id, v);
                              return next;
                            });
                          }}
                          className={cantInputClass}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {f.nivel === "critico" ? (
                            <Badge variant="destructive" className="text-[10px] uppercase">
                              Crítico
                            </Badge>
                          ) : f.nivel === "cerca" ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/30 bg-destructive/5 text-[10px] text-destructive uppercase"
                            >
                              Bajo
                            </Badge>
                          ) : f.cantidad === null ? (
                            <Badge variant="outline" className="text-[10px] uppercase">
                              Sin dato
                            </Badge>
                          ) : f.tono === "regular" ? (
                            <Badge
                              variant="outline"
                              className="border-amber-600/30 bg-amber-500/5 text-[10px] text-amber-700 dark:text-amber-400 uppercase"
                            >
                              Regular
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-600/30 bg-emerald-500/5 text-[10px] text-emerald-600 dark:text-emerald-400 uppercase"
                            >
                              Bien
                            </Badge>
                          )}
                          {f.cantidad !== null ? (
                            <div className="relative h-2 w-16 rounded-full bg-muted overflow-hidden border border-border/20">
                              <div
                                className={cn("h-full rounded-full", colorBarra)}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden max-h-[min(55vh,32rem)] overflow-auto divide-y divide-border/60">
            {filasOrdenadas.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "px-4 py-3.5 border-l-4 space-y-2",
                  f.tono === "alerta"
                    ? "border-l-destructive"
                    : f.tono === "regular"
                      ? "border-l-amber-500"
                      : "border-l-emerald-500"
                )}
              >
                <p className="font-semibold text-sm">{f.nombre}</p>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">A manejar</p>
                    <p className="text-sm tabular-nums font-medium">{f.stockObjetivo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Stock actual</p>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      name={`stock_${f.id}`}
                      value={valores.get(f.id) ?? ""}
                      disabled={!puedeEditar || pending}
                      placeholder="0"
                      onChange={(e) => {
                        const v = e.target.value;
                        setValores((prev) => {
                          const next = new Map(prev);
                          next.set(f.id, v);
                          return next;
                        });
                      }}
                      className={cn(cantInputClass, "max-w-none mx-0")}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/40 bg-muted/5 px-5 py-4">
        {puedeEditar ? (
          <Button type="submit" size="sm" disabled={pending || filas.length === 0}>
            {pending ? "Guardando…" : "Guardar stock"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Solo lectura</p>
        )}
      </div>
    </form>
  );

  if (embebido) {
    return (
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="space-y-3 border-b border-border/60 bg-muted/20 px-5 py-4">
          {encabezado}
          {alertas}
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar insumo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        {cuerpo}
      </div>
    );
  }

  return (
    <Card size="sm" className="border border-border/80 shadow-sm bg-card/40 backdrop-blur-sm overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4.5 space-y-3">
        {encabezado}
        {alertas}
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar insumo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">{cuerpo}</CardContent>
    </Card>
  );
}
