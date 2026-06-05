"use client";

import { Fragment, useMemo, useState } from "react";
import { BarChart2, Search } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CategoriaGrupoCabeceraContenido,
  CategoriasColapsarTodasBar,
  useCategoriasColapsables,
} from "@/components/medicamentos/categoria-grupo-colapsable";
import { StockNivelLeyenda } from "@/components/posta/stock-nivel-leyenda";
import {
  CATEGORIAS_AGRUPACION_UI,
  categoriaAgrupacionListado,
  etiquetaMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { cn } from "@/lib/utils";

export type FilaStockTabla = {
  id: string;
  nombre: string;
  unidad: string;
  categoria: MedicamentoCategoria;
  /** `null` si aún no hay fila en `stock_mensual_posta` para este mes. */
  stockFichaMes: number | null;
  stockCrit: number;
  stockRec: number;
  disponible: number;
  stockAvis: number;
  nivel: "critico" | "cerca" | null;
  tono: "alerta" | "regular" | "ok";
  ingresoMes?: number;
  descuentoMes?: number;
};

export function StockTablaDashboard({
  filas,
  descuentoMesHref,
}: {
  filas: FilaStockTabla[];
  descuentoMesHref: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const colapsables = useCategoriasColapsables();
  const forzarExpandidas = busqueda.trim() !== "";

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.nombre.toLowerCase().includes(q));
  }, [filas, busqueda]);

  const categoriasVisibles = useMemo(
    () =>
      CATEGORIAS_AGRUPACION_UI.filter((cat) =>
        filasFiltradas.some((f) => categoriaAgrupacionListado(f.categoria) === cat)
      ),
    [filasFiltradas]
  );

  return (
    <Card size="sm" className="border border-border/80 shadow-sm bg-card/40 backdrop-blur-sm overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className="size-4.5 text-primary" />
              Stock posta por medicamento
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Stock final según el cierre anterior, descontando consumos y sumando ingresos del mes.
            </CardDescription>
          </div>
          <StockNivelLeyenda className="shrink-0" compact />
        </div>
        {/* Buscador integrado en el header */}
        <div className="relative mt-3 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar medicamento…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </CardHeader>
      <div className="p-0">
        {filas.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 py-14 text-center text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/70 mb-4 border border-border/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-7"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground">Catálogo vacío</h3>
            <p className="text-xs text-muted-foreground/80 mt-1 max-w-[280px]">
              No hay medicamentos o insumos activos registrados en el catálogo de esta posta.
            </p>
          </div>
        ) : filasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 py-14 text-center text-muted-foreground animate-fade-in">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/70 mb-4 border border-primary/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-7 text-primary/60"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6" />
              </svg>
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground">Sin resultados</h3>
            <p className="text-xs text-muted-foreground/80 mt-1 max-w-[280px]">
              No encontramos coincidencias para &ldquo;<span className="font-medium text-foreground">{busqueda}</span>&rdquo;. Intente con otro término.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-border/40 px-4 py-2.5 sm:px-5">
              <CategoriasColapsarTodasBar
                categorias={categoriasVisibles}
                onExpandirTodas={colapsables.expandirTodas}
                onColapsarTodas={colapsables.colapsarTodas}
              />
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block max-h-[min(70vh,36rem)] overflow-auto">
              <table className="w-full min-w-[38rem] text-left text-sm border-collapse">
                <thead className="sticky top-0 z-20 border-b border-border/60 bg-muted/90 backdrop-blur-sm text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Medicamento</th>
                    <th className="px-5 py-3 text-right">Stock Inicial</th>
                    <th className="px-5 py-3 text-right">Mín. Crítico</th>
                    <th className="px-5 py-3 text-right">Disponible</th>
                    <th className="px-5 py-3 text-center">Nivel de Stock</th>
                    <th className="px-5 py-3 text-right" title="Stock contado físicamente (AVIS)">AVIS</th>
                    <th className="px-5 py-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {CATEGORIAS_AGRUPACION_UI.map((cat) => {
                    const rows = filasFiltradas.filter(
                      (f) => categoriaAgrupacionListado(f.categoria) === cat
                    );
                    if (rows.length === 0) return null;
                    const expandida = colapsables.estaExpandida(cat, forzarExpandidas);
                    return (
                      <Fragment key={cat}>
                        <tr className="border-y-2 border-border/60 bg-muted/60">
                          <td colSpan={7} className="px-2 py-1">
                            <CategoriaGrupoCabeceraContenido
                              etiqueta={etiquetaMedicamentoCategoria[cat]}
                              expandida={expandida}
                              onToggle={() => colapsables.toggle(cat)}
                              cantidad={rows.length}
                              className="px-1 py-1.5"
                            />
                          </td>
                        </tr>
                        {expandida
                          ? rows.map((f) => {
                          const maxVal = Math.max(f.stockRec, f.disponible, 1);
                          const pct = Math.min(100, Math.round((f.disponible / maxVal) * 100));
                          const critPct = Math.min(95, Math.max(5, Math.round((f.stockCrit / maxVal) * 100)));
                          const colorBarra =
                            f.tono === "alerta"
                              ? "bg-destructive"
                              : f.tono === "regular"
                                ? "bg-amber-500"
                                : "bg-emerald-500";
                          const claseDisponible =
                            f.tono === "alerta"
                              ? "text-destructive font-bold"
                              : f.tono === "regular"
                                ? "text-amber-600 dark:text-amber-400 font-semibold"
                                : "text-emerald-600 dark:text-emerald-400 font-semibold";
                          return (
                            <tr
                              key={f.id}
                              className="hover:bg-muted/25 transition-colors duration-150"
                            >
                              <td
                                className={cn(
                                  "px-5 py-3.5 font-semibold text-foreground border-l-4",
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
                              <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                                {f.stockFichaMes === null
                                  ? "—"
                                  : f.stockFichaMes.toLocaleString("es-CL")}
                              </td>
                              <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground/70 text-xs">
                                {f.stockCrit.toLocaleString("es-CL")}
                              </td>
                              <td className={cn("px-5 py-3.5 text-right tabular-nums", claseDisponible)}>
                                {f.disponible.toLocaleString("es-CL")}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-center gap-2.5">
                                  <div className="relative h-2.5 w-24 rounded-full bg-muted overflow-hidden shrink-0 border border-border/20">
                                    <div
                                      className={cn("h-full rounded-full transition-all duration-300", colorBarra)}
                                      style={{ width: `${pct}%` }}
                                    />
                                    {/* Línea divisoria del límite crítico */}
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 dark:bg-rose-400/80 z-10"
                                      style={{ left: `${critPct}%` }}
                                      title={`Mínimo crítico: ${f.stockCrit}`}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-muted-foreground/80 w-8 text-right shrink-0">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                                {f.stockAvis.toLocaleString("es-CL")}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                {f.nivel === "critico" ? (
                                  <Badge variant="destructive" className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">Crítico</Badge>
                                ) : f.nivel === "cerca" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-destructive/30 bg-destructive/5 font-semibold text-[10px] text-destructive uppercase tracking-wider px-2 py-0.5"
                                  >
                                    Bajo
                                  </Badge>
                                ) : f.tono === "regular" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-600/30 bg-amber-500/5 font-semibold text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider px-2 py-0.5"
                                  >
                                    Regular
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-600/30 bg-emerald-500/5 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-2 py-0.5"
                                  >
                                    Bien
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden max-h-[min(70vh,36rem)] overflow-auto divide-y divide-border/60">
              {CATEGORIAS_AGRUPACION_UI.map((cat) => {
                const rows = filasFiltradas.filter(
                  (f) => categoriaAgrupacionListado(f.categoria) === cat
                );
                if (rows.length === 0) return null;
                const expandida = colapsables.estaExpandida(cat, forzarExpandidas);
                return (
                  <div key={cat} className="bg-muted/5">
                    <div className="sticky top-0 z-10 border-y-2 border-border/60 bg-muted/80 px-2 py-1 backdrop-blur-sm">
                      <CategoriaGrupoCabeceraContenido
                        etiqueta={etiquetaMedicamentoCategoria[cat]}
                        expandida={expandida}
                        onToggle={() => colapsables.toggle(cat)}
                        cantidad={rows.length}
                        className="px-1 py-1.5"
                      />
                    </div>

                    {expandida ? (
                    <div className="divide-y divide-border/40 bg-background">
                      {rows.map((f) => {
                        const maxVal = Math.max(f.stockRec, f.disponible, 1);
                        const pct = Math.min(100, Math.round((f.disponible / maxVal) * 100));
                        
                        let toneBorderClass = "border-l-emerald-500";
                        let badgeColorClass = "border-emerald-600/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400";
                        let badgeText = "Bien";
                        let stockColorClass = "text-emerald-600 dark:text-emerald-400 font-semibold";
                        
                        if (f.tono === "alerta") {
                          toneBorderClass = "border-l-destructive";
                          if (f.nivel === "critico") {
                            badgeColorClass = "bg-destructive text-destructive-foreground border-transparent";
                            badgeText = "Crítico";
                          } else {
                            badgeColorClass = "border-destructive/30 bg-destructive/5 text-destructive";
                            badgeText = "Bajo";
                          }
                          stockColorClass = "text-destructive font-bold";
                        } else if (f.tono === "regular") {
                          toneBorderClass = "border-l-amber-500";
                          badgeColorClass = "border-amber-600/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
                          badgeText = "Regular";
                          stockColorClass = "text-amber-600 dark:text-amber-400 font-semibold";
                        }

                        return (
                          <div
                            key={f.id}
                            className={cn(
                              "px-4 py-3.5 flex flex-col gap-2.5 border-l-4",
                              toneBorderClass
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-foreground leading-snug">
                                  {f.nombre}
                                </p>
                                {f.unidad && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Unidad: {f.unidad}
                                  </p>
                                )}
                              </div>
                              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none shrink-0", badgeColorClass)}>
                                {badgeText}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1 py-1.5 px-2 bg-muted/40 rounded-lg border border-border/30 text-center">
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Inicial</p>
                                <p className="text-xs font-semibold text-foreground mt-0.5 tabular-nums">
                                  {f.stockFichaMes === null ? "—" : f.stockFichaMes.toLocaleString("es-CL")}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Crítico</p>
                                <p className="text-xs font-semibold text-muted-foreground/75 mt-0.5 tabular-nums">
                                  {f.stockCrit.toLocaleString("es-CL")}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Disponible</p>
                                <p className={cn("text-xs mt-0.5 tabular-nums", stockColorClass)}>
                                  {f.disponible.toLocaleString("es-CL")}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span>Porcentaje:</span>
                                <span className="font-mono font-bold text-foreground">{pct}%</span>
                              </div>
                              {f.stockAvis > 0 && (
                                <span className="font-semibold text-sky-600 dark:text-sky-400">
                                  AVIS: {f.stockAvis.toLocaleString("es-CL")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="p-4 text-xs text-muted-foreground border-t border-border/40 bg-muted/5">
          Orden: categoría del catálogo, luego alerta → regular → bien, y dentro de cada
          grupo por menor disponible y nombre. Detalle día a día en{" "}
          <Link className="underline underline-offset-2 hover:text-primary transition-colors" href={descuentoMesHref}>
            Descuento
          </Link>
          .
        </p>
      </div>
    </Card>
  );
}
