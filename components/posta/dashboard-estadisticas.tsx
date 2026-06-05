"use client";

import { useMemo, useState } from "react";
import { 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Package, 
  Sparkles,
  ShoppingBag,
  FileSpreadsheet
} from "lucide-react";
import Link from "next/link";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type FilaStockTabla } from "./stock-tabla-dashboard";
import { type PedidoMensualCabecera } from "@/lib/posta/pedidos-mensuales-por-tipo";
import { cn } from "@/lib/utils";

type Props = {
  filas: FilaStockTabla[];
  pedidoGeneral: PedidoMensualCabecera | null;
  pedidoContra: PedidoMensualCabecera | null;
  postaId: string;
  ymQuery: string;
};

type StepState = "upcoming" | "active" | "completed" | "warning";

export function DashboardEstadisticas({ filas, pedidoGeneral, pedidoContra, postaId, ymQuery }: Props) {
  const [tabRotacion, setTabRotacion] = useState<"consumo" | "ingreso">("consumo");

  // Calcular estadísticas de medicamentos
  const stats = useMemo(() => {
    let totalIngresos = 0;
    let totalDescuentos = 0;
    const quiebres: FilaStockTabla[] = [];

    for (const f of filas) {
      totalIngresos += f.ingresoMes ?? 0;
      totalDescuentos += f.descuentoMes ?? 0;
      if (f.disponible === 0) {
        quiebres.push(f);
      }
    }

    // Top 5 más consumidos
    const topConsumo = [...filas]
      .filter((f) => (f.descuentoMes ?? 0) > 0)
      .sort((a, b) => (b.descuentoMes ?? 0) - (a.descuentoMes ?? 0))
      .slice(0, 5);

    // Top 5 más ingresados
    const topIngreso = [...filas]
      .filter((f) => (f.ingresoMes ?? 0) > 0)
      .sort((a, b) => (b.ingresoMes ?? 0) - (a.ingresoMes ?? 0))
      .slice(0, 5);

    return {
      totalIngresos,
      totalDescuentos,
      quiebres,
      topConsumo,
      topIngreso,
    };
  }, [filas]);

  // Balance porcentual de movimientos
  const balancePorcentaje = useMemo(() => {
    const total = stats.totalIngresos + stats.totalDescuentos;
    if (total === 0) return { ingresos: 50, descuentos: 50 };
    return {
      ingresos: Math.round((stats.totalIngresos / total) * 100),
      descuentos: Math.round((stats.totalDescuentos / total) * 100),
    };
  }, [stats]);

  // Renderizar indicador de estado de pedido (Stepper)
  const renderPedidoStepper = (pedido: PedidoMensualCabecera | null, titulo: string, defaultHref: string) => {
    if (!pedido) {
      return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/5 p-4.5">
          <div className="flex items-center gap-3 text-left">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Pedido {titulo} no iniciado</p>
              <p className="text-xs text-muted-foreground mt-0.5">El pedido para este mes aún no ha sido registrado.</p>
            </div>
          </div>
          <Link
            href={defaultHref}
            className="w-full sm:w-auto shrink-0 rounded-lg bg-primary px-3.5 py-2 text-center text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/95"
          >
            Iniciar pedido
          </Link>
        </div>
      );
    }

    const { estado } = pedido;

    // Mapeo de estados del pedido
    // Steps: BORRADOR -> ENVIADO (u OBSERVADO/RECHAZADO) -> APROBADO -> DESPACHADO -> RECIBIDO
    const steps = [
      { key: "BORRADOR", label: "Borrador", icon: Clock },
      { key: "ENVIADO", label: "Enviado", icon: Clock },
      { key: "APROBADO", label: "Aprobado", icon: CheckCircle2 },
      { key: "DESPACHADO", label: "Despachado", icon: Truck },
      { key: "RECIBIDO", label: "Recibido", icon: Package },
    ];

    const getStepState = (stepKey: string, index: number): StepState => {
      if (estado === "OBSERVADO" && stepKey === "ENVIADO") return "warning";
      if (estado === "RECHAZADO" && stepKey === "ENVIADO") return "warning";

      const estadoIdxMap: Record<string, number> = {
        BORRADOR: 0,
        ENVIADO: 1,
        OBSERVADO: 1,
        RECHAZADO: 1,
        APROBADO: 2,
        DESPACHADO: 3,
        RECIBIDO: 4,
      };

      const currentIdx = estadoIdxMap[estado] ?? 0;
      if (index < currentIdx) return "completed";
      if (index === currentIdx) return "active";
      return "upcoming";
    };

    return (
      <div className="rounded-xl border border-border bg-card p-4.5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pedido {titulo}
            </span>
            {estado === "OBSERVADO" && (
              <Badge variant="outline" className="border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wider px-1.5 py-0">
                Observado
              </Badge>
            )}
            {estado === "RECHAZADO" && (
              <Badge variant="destructive" className="font-bold text-[9px] uppercase tracking-wider px-1.5 py-0">
                Rechazado
              </Badge>
            )}
            {estado === "RECIBIDO" && (
              <Badge variant="outline" className="border-emerald-600/35 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider px-1.5 py-0">
                Recibido
              </Badge>
            )}
          </div>
          <Link
            href={defaultHref}
            className="text-xs font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Ver detalle
          </Link>
        </div>

        {/* Stepper visual */}
        <div className="relative flex items-center justify-between w-full mt-2">
          {/* Línea de fondo del stepper */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-muted rounded-full -z-10" />

          {/* Línea de progreso activa */}
          {(() => {
            const estadoIdxMap: Record<string, number> = {
              BORRADOR: 0,
              ENVIADO: 1,
              OBSERVADO: 1,
              RECHAZADO: 1,
              APROBADO: 2,
              DESPACHADO: 3,
              RECIBIDO: 4,
            };
            const currentIdx = estadoIdxMap[estado] ?? 0;
            const widthPct = (currentIdx / (steps.length - 1)) * 100;
            return (
              <div 
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 h-1 rounded-full -z-10 transition-all duration-500",
                  estado === "OBSERVADO" || estado === "RECHAZADO" ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `calc(${widthPct}% - 1rem)` }}
              />
            );
          })()}

          {/* Nodos del Stepper */}
          {steps.map((step, idx) => {
            const stepState = getStepState(step.key, idx);
            const StepIcon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 transition-all duration-300 text-xs",
                    stepState === "completed" && "bg-primary border-primary text-primary-foreground",
                    stepState === "active" && "bg-background border-primary text-primary font-bold shadow-md scale-110 ring-4 ring-primary/10",
                    stepState === "warning" && "bg-amber-500 border-amber-500 text-white font-bold scale-110 shadow-md ring-4 ring-amber-500/20",
                    stepState === "upcoming" && "bg-background border-muted text-muted-foreground"
                  )}
                  title={step.label}
                >
                  {stepState === "completed" ? (
                    <CheckCircle2 className="size-4.5 stroke-[2.5]" />
                  ) : stepState === "warning" ? (
                    <AlertCircle className="size-4.5" />
                  ) : (
                    <span className="font-mono text-[10px] font-bold">{idx + 1}</span>
                  )}
                </div>
                <span 
                  className={cn(
                    "text-[10px] font-semibold text-center leading-none hidden sm:inline-block",
                    (stepState === "active" || stepState === "completed") && "text-foreground",
                    stepState === "warning" && "text-amber-600 dark:text-amber-400 font-bold",
                    stepState === "upcoming" && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Comentario del administrador o posta */}
        {pedido.comentario_posta && (
          <p className="text-[11px] text-muted-foreground/90 bg-muted/30 p-2.5 rounded-lg border border-border/40 italic leading-relaxed">
            <span className="font-semibold not-italic block text-[10px] uppercase tracking-wider text-foreground/80 mb-0.5">Nota de la Posta:</span>
            &ldquo;{pedido.comentario_posta}&rdquo;
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-fade-in">
      
      {/* Columna Izquierda: Balance y Alertas */}
      <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
        
        {/* Balance de movimientos y stock agotado */}
        <Card size="sm" className="border border-border/80 shadow-sm bg-card flex-1 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/5 px-5 py-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4.5 text-sky-500" />
              Balance de Movimientos y Alertas
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Flujo de entradas y salidas de stock registradas este mes.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-5 flex-1 flex flex-col justify-between gap-6">
            
            {/* Balance de movimientos */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Balance Mensual</span>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                  stats.totalIngresos > stats.totalDescuentos
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : stats.totalIngresos < stats.totalDescuentos
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                      : "bg-muted border-border text-muted-foreground"
                )}>
                  {stats.totalIngresos > stats.totalDescuentos ? (
                    <>
                      <ArrowUpRight className="size-3.5" />
                      En Reposición (+{stats.totalIngresos - stats.totalDescuentos})
                    </>
                  ) : stats.totalIngresos < stats.totalDescuentos ? (
                    <>
                      <ArrowDownRight className="size-3.5" />
                      En Disminución (-{stats.totalDescuentos - stats.totalIngresos})
                    </>
                  ) : (
                    "Estable o sin movimientos"
                  )}
                </span>
              </div>

              {/* Progress bar dual */}
              <div className="h-6 w-full rounded-full bg-muted overflow-hidden flex text-xs font-bold text-white shadow-inner border border-border/40">
                {stats.totalIngresos === 0 && stats.totalDescuentos === 0 ? (
                  <div className="w-full flex items-center justify-center text-muted-foreground font-normal text-xs italic">
                    Sin movimientos registrados en este mes
                  </div>
                ) : (
                  <>
                    <div 
                      className="bg-emerald-500 flex items-center justify-center transition-all duration-300 relative group overflow-hidden" 
                      style={{ width: `${balancePorcentaje.ingresos}%` }}
                    >
                      {balancePorcentaje.ingresos >= 15 && (
                        <span className="truncate px-1.5 text-[10px]">{balancePorcentaje.ingresos}%</span>
                      )}
                    </div>
                    <div 
                      className="bg-amber-500 flex items-center justify-center transition-all duration-300 relative group overflow-hidden" 
                      style={{ width: `${balancePorcentaje.descuentos}%` }}
                    >
                      {balancePorcentaje.descuentos >= 15 && (
                        <span className="truncate px-1.5 text-[10px]">{balancePorcentaje.descuentos}%</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 text-center">
                <div className="rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center justify-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Ingresos (Entradas)
                  </p>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                    {stats.totalIngresos.toLocaleString("es-CL")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-none">unidades ingresadas</p>
                </div>
                <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/10 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center justify-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" />
                    Consumo (Descuentos)
                  </p>
                  <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                    {stats.totalDescuentos.toLocaleString("es-CL")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-none">unidades descontadas</p>
                </div>
              </div>
            </div>

            {/* Stock Agotado */}
            <div className="border-t border-border/50 pt-5">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stock Agotado</span>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                  stats.quiebres.length > 0
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                )}>
                  {stats.quiebres.length > 0 ? `${stats.quiebres.length} agotados` : "Ninguno"}
                </span>
              </div>

              {stats.quiebres.length > 0 ? (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.02] p-3">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                    Medicamentos sin stock (Requieren solicitud urgente):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.quiebres.slice(0, 5).map((f) => (
                      <span 
                        key={f.id} 
                        className="inline-flex items-center rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-500/15 max-w-[220px] truncate"
                      >
                        {f.nombre}
                      </span>
                    ))}
                    {stats.quiebres.length > 5 && (
                      <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-xs font-bold text-muted-foreground border">
                        +{stats.quiebres.length - 5} más
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.01] p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  No hay medicamentos agotados. Todos los medicamentos activos disponen de al menos 1 unidad.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Columna Derecha: Rotación de Medicamentos */}
      <div className="space-y-6">
        
        {/* Mayor rotación */}
        <Card size="sm" className="border border-border/80 shadow-sm bg-card h-full flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-border/40 bg-muted/5 px-5 py-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4.5 text-amber-500" />
              Rotación del Mes
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Medicamentos con mayor flujo de stock.
            </CardDescription>
            
            {/* Pestañas de control */}
            <div className="flex rounded-lg bg-muted p-0.5 mt-3 border border-border/30">
              <button
                type="button"
                onClick={() => setTabRotacion("consumo")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-center text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                  tabRotacion === "consumo"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingDown className="size-3.5 text-amber-500" />
                Mayor Consumo
              </button>
              <button
                type="button"
                onClick={() => setTabRotacion("ingreso")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-center text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                  tabRotacion === "ingreso"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingUp className="size-3.5 text-emerald-500" />
                Mayor Ingreso
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 flex-1">
            {tabRotacion === "consumo" ? (
              stats.topConsumo.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <p className="text-xs italic">No se han registrado consumos en este mes.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {stats.topConsumo.map((med) => {
                    const cant = med.descuentoMes ?? 0;
                    // Porcentaje relativo al máximo de esta lista para dibujar la barra
                    const maxVal = stats.topConsumo[0]?.descuentoMes ?? 1;
                    const widthPct = Math.min(100, Math.round((cant / maxVal) * 100));

                    return (
                      <div key={med.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs gap-4">
                          <span className="font-semibold text-foreground truncate" title={med.nombre}>
                            {med.nombre}
                          </span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0 text-right">
                            {cant.toLocaleString("es-CL")} <span className="font-normal text-[10px] text-muted-foreground">{med.unidad}</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/20">
                          <div 
                            className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              stats.topIngreso.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <p className="text-xs italic">No se han registrado ingresos en este mes.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {stats.topIngreso.map((med) => {
                    const cant = med.ingresoMes ?? 0;
                    const maxVal = stats.topIngreso[0]?.ingresoMes ?? 1;
                    const widthPct = Math.min(100, Math.round((cant / maxVal) * 100));

                    return (
                      <div key={med.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs gap-4">
                          <span className="font-semibold text-foreground truncate" title={med.nombre}>
                            {med.nombre}
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 text-right">
                            {cant.toLocaleString("es-CL")} <span className="font-normal text-[10px] text-muted-foreground">{med.unidad}</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/20">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stepper de Pedido Mensual - Ancho Completo */}
      <div className="lg:col-span-3 space-y-4">
        <h3 className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5 px-0.5">
          <FileSpreadsheet className="size-4.5 text-primary" />
          Seguimiento de Pedido Mensual ({ymQuery})
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {renderPedidoStepper(
            pedidoGeneral, 
            "General", 
            `/postas/${postaId}/pedidos?ym=${ymQuery}&tab=general`
          )}
          {renderPedidoStepper(
            pedidoContra, 
            "Contra Receta", 
            `/postas/${postaId}/pedidos?ym=${ymQuery}&tab=contra-receta`
          )}
        </div>
      </div>

    </div>
  );
}
