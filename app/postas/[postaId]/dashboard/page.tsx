import Link from "next/link";
import { Fragment } from "react";
import { Package, AlertTriangle, TrendingUp, Activity, BarChart2, ArrowLeft } from "lucide-react";

import { StockNivelLeyenda } from "@/components/posta/stock-nivel-leyenda";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  puedeRegistrarOperacionesPosta,
  puedeRegistrarStockYAvisPosta,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";
import {
  fechaCalendarioEnZonaIANA,
  rangoFechasMesISO,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";
import {
  etiquetaMedicamentoCategoria,
  indiceOrdenCategoria,
  MEDICAMENTO_CATEGORIAS,
  normalizarMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { nivelAlertaStock, nivelStockListadoVisual } from "@/lib/posta/admin-stock-alerta-postas";
import {
  snapshotLedgerMesPosta,
  type MedLedgerMin,
} from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ postaId: string }> };

export default async function PostaDashboardPage({ params }: PageProps) {
  const { postaId } = await params;
  const { profile } = await requirePerfilUsuario();
  const puedeRegistrarDescuentos = puedeRegistrarOperacionesPosta(profile, postaId);
  const puedeRegistrarIngresosYAvis = puedeRegistrarStockYAvisPosta(profile, postaId);
  const verAdmin = tieneAccesoGlobalAdmin(profile);
  const supabase = await createServerSupabaseClient();

  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const [anioStr, mesStr] = hoy.split("-");
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const { desde, hasta } = rangoFechasMesISO(anio, mes);
  const etiquetaMes = new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  const ymParam = `${anio}-${String(mes).padStart(2, "0")}`;
  const descuentoMesHref = `/postas/${postaId}/descuento?ym=${ymParam}`;

  const [{ data: medicamentos }, { data: curStock }, { data: movs }, { data: avisRows }] =
    await Promise.all([
      supabase
        .from("medicamentos")
        .select(
          "id, nombre, unidad_medida, categoria, stock_recomendado_default, stock_critico_default"
        )
        .eq("activo", true)
        .order("categoria", { ascending: true })
        .order("nombre", { ascending: true }),
      supabase
        .from("stock_mensual_posta")
        .select(
          "medicamento_id, stock_recomendado_config, stock_critico_config, stock_final"
        )
        .eq("posta_id", postaId)
        .eq("anio", anio)
        .eq("mes", mes),
      supabase
        .from("movimientos_diarios_consumo")
        .select(
          "medicamento_id, fecha, cantidad_con_avis, cantidad_sin_avis, total_dia"
        )
        .eq("posta_id", postaId)
        .eq("anulado", false)
        .gte("fecha", desde)
        .lte("fecha", hasta),
      supabase
        .from("stock_avis_mensual")
        .select("medicamento_id, stock_avis_cantidad")
        .eq("posta_id", postaId)
        .eq("anio", anio)
        .eq("mes", mes),
    ]);

  const medsRows = medicamentos && Array.isArray(medicamentos) ? medicamentos : [];
  const medsLedger: MedLedgerMin[] = [];
  const metaPorId = new Map<
    string,
    { nombre: string; unidad: string; categoria: MedicamentoCategoria }
  >();

  for (const row of medsRows) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    const rec = Number(r.stock_recomendado_default);
    const crit = Number(r.stock_critico_default);
    medsLedger.push({
      id: r.id,
      stock_recomendado_default: Number.isFinite(rec) ? Math.max(0, Math.trunc(rec)) : 0,
      stock_critico_default: Number.isFinite(crit) ? Math.max(0, Math.trunc(crit)) : 0,
    });
    metaPorId.set(r.id, {
      nombre: typeof r.nombre === "string" ? r.nombre : "—",
      unidad: typeof r.unidad_medida === "string" ? r.unidad_medida : "",
      categoria: normalizarMedicamentoCategoria(
        typeof r.categoria === "string" ? r.categoria : undefined
      ),
    });
  }

  const snap = await snapshotLedgerMesPosta(
    supabase,
    postaId,
    anio,
    mes,
    medsLedger,
    { curStockRows: curStock ?? [], movsMesRows: movs ?? [] }
  );

  const stockAvisPorMed = new Map<string, number>();
  if (Array.isArray(avisRows)) {
    for (const row of avisRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id !== "string") continue;
      const n = Number(r.stock_avis_cantidad);
      stockAvisPorMed.set(
        r.medicamento_id,
        Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
      );
    }
  }

  const stockFinalPorMed = new Map<string, number>();
  const idsConFichaMensual = new Set<string>();
  if (Array.isArray(curStock)) {
    for (const row of curStock) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id !== "string") continue;
      idsConFichaMensual.add(r.medicamento_id);
      const sf = Number(r.stock_final);
      stockFinalPorMed.set(
        r.medicamento_id,
        Number.isFinite(sf) ? Math.max(0, Math.trunc(sf)) : 0
      );
    }
  }

  let sumDisponible = 0;
  let nCritico = 0;
  let nCerca = 0;

  type FilaStockTabla = {
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
  };

  const filasStock: FilaStockTabla[] = [];

  for (const m of medsLedger) {
    const s = snap.get(m.id);
    if (!s) continue;
    sumDisponible += s.disponible;
    const nivel = nivelAlertaStock(
      s.disponible,
      s.stock_critico,
      s.stock_recomendado
    );
    if (nivel === "critico") nCritico += 1;
    else if (nivel === "cerca") nCerca += 1;
    const tono = nivelStockListadoVisual(
      s.disponible,
      s.stock_critico,
      s.stock_recomendado
    );
    const meta = metaPorId.get(m.id);
    filasStock.push({
      id: m.id,
      nombre: meta?.nombre ?? "—",
      unidad: meta?.unidad ?? "",
      categoria: meta?.categoria ?? "OTROS",
      stockFichaMes: idsConFichaMensual.has(m.id)
        ? (stockFinalPorMed.get(m.id) ?? 0)
        : null,
      stockCrit: s.stock_critico,
      stockRec: s.stock_recomendado,
      disponible: s.disponible,
      stockAvis: stockAvisPorMed.get(m.id) ?? 0,
      nivel,
      tono,
    });
  }

  const ordenTono = (f: FilaStockTabla) => {
    if (f.tono === "alerta") return f.nivel === "critico" ? 0 : 1;
    if (f.tono === "regular") return 2;
    return 3;
  };

  filasStock.sort((a, b) => {
    const cOrd =
      indiceOrdenCategoria(a.categoria) - indiceOrdenCategoria(b.categoria);
    if (cOrd !== 0) return cOrd;
    const ta = ordenTono(a) - ordenTono(b);
    if (ta !== 0) return ta;
    if (a.disponible !== b.disponible) return a.disponible - b.disponible;
    return a.nombre.localeCompare(b.nombre, "es-CL", { sensitivity: "base" });
  });

  const nCatalogo = medsLedger.length;

  const cards = [
    {
      title: "Unidades disponibles (estimado)",
      value: sumDisponible.toLocaleString("es-CL"),
      hint: `Stock según registro · ${etiquetaMes}`,
      icon: Activity,
      color: "primary",
    },
    {
      title: "Bajo stock crítico",
      value: nCritico.toLocaleString("es-CL"),
      hint: "Medicamentos en o bajo el mínimo",
      icon: AlertTriangle,
      color: "destructive",
      count: nCritico,
    },
    {
      title: "Cerca del mínimo",
      value: nCerca.toLocaleString("es-CL"),
      hint: "Es recomendable revisarlos pronto",
      icon: TrendingUp,
      color: "amber",
      count: nCerca,
    },
    {
      title: "Medicamentos en catálogo",
      value: nCatalogo.toLocaleString("es-CL"),
      hint: "Activos en el sistema",
      icon: Package,
      color: "info",
    },
  ];

  const estadoSedeBadge = nCritico > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-1 text-xs font-semibold text-destructive animate-pulse">
      <span className="size-1.5 rounded-full bg-destructive" />
      Reabastecimiento urgente
    </span>
  ) : nCerca > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Stock bajo en revisión
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Niveles estables
    </span>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-tr from-primary/5 via-card to-card p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Resumen mensual de stock
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {puedeRegistrarDescuentos ? (
                <>
                  Cifras del mes calendario <span className="font-semibold text-foreground">{etiquetaMes}</span>{" "}
                  según el registro del mes (cierre anterior + ingresos − descuentos). El detalle día a
                  día está en{" "}
                  <Link className="underline underline-offset-4 hover:text-primary transition-colors" href={descuentoMesHref}>
                    Descuento
                  </Link>
                  .
                </>
              ) : puedeRegistrarIngresosYAvis ? (
                <>
                  Puede cargar ingresos y declarar stock AVIS; el descuento diario lo registra
                  el encargado. Mes en pantalla:{" "}
                  <span className="font-semibold text-foreground">{etiquetaMes}</span>.
                </>
              ) : (
                <>
                  Solo lectura. Stock del mes{" "}
                  <span className="font-semibold text-foreground">{etiquetaMes}</span> según el registro de la
                  posta.
                </>
              )}
            </p>
          </div>
          <div className="shrink-0">
            {estadoSedeBadge}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const isCritical = c.color === "destructive" && c.count && c.count > 0;
          const isWarning = c.color === "amber" && c.count && c.count > 0;
          
          let cardBgClass = "bg-card border-border/80 hover:border-border hover:shadow-sm";
          let iconWrapperClass = "bg-muted text-muted-foreground";
          let valueClass = "text-foreground";
          
          if (c.color === "primary") {
            iconWrapperClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400";
            valueClass = "text-sky-700 dark:text-sky-400";
          } else if (c.color === "destructive") {
            if (isCritical) {
              cardBgClass = "bg-card border-rose-500/30 hover:border-rose-500/45 hover:shadow-sm";
              iconWrapperClass = "bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse";
              valueClass = "text-rose-600 dark:text-rose-400";
            } else {
              iconWrapperClass = "bg-muted/80 text-muted-foreground/60";
              valueClass = "text-muted-foreground/50";
            }
          } else if (c.color === "amber") {
            if (isWarning) {
              cardBgClass = "bg-card border-amber-500/30 hover:border-amber-500/45 hover:shadow-sm";
              iconWrapperClass = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
              valueClass = "text-amber-600 dark:text-amber-400";
            } else {
              iconWrapperClass = "bg-muted/80 text-muted-foreground/60";
              valueClass = "text-muted-foreground/50";
            }
          } else if (c.color === "info") {
            iconWrapperClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
            valueClass = "text-emerald-700 dark:text-emerald-400";
          }

          return (
            <Card 
              key={c.title} 
              size="sm" 
              className={cn(
                "overflow-hidden border transition-all duration-200 shadow-sm p-4.5 flex flex-col justify-between hover:shadow",
                cardBgClass
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground/80 leading-normal">{c.hint}</p>
                </div>
                <div className={cn("p-2 rounded-lg shrink-0", iconWrapperClass)}>
                  <Icon className="size-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <p className={cn("font-heading text-3xl font-bold tracking-tight tabular-nums", valueClass)}>
                  {c.value}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card size="sm" className="border border-border/80 shadow-sm bg-card/40 backdrop-blur-sm overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </CardHeader>
        <div className="p-0">
          {filasStock.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No hay medicamentos activos en el catálogo.
            </p>
          ) : (
            <div className="max-h-[min(70vh,36rem)] overflow-auto">
              <table className="w-full min-w-[38rem] text-left text-sm border-collapse">
                <thead className="sticky top-0 z-20 border-b border-border/60 bg-muted/90 backdrop-blur-sm text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Medicamento</th>
                    <th className="px-5 py-3 text-right">Stock Inicial</th>
                    <th className="px-5 py-3 text-right">Mín. Crítico</th>
                    <th className="px-5 py-3 text-right">Disponible</th>
                    <th className="px-5 py-3 text-center">Nivel de Stock</th>
                    <th className="px-5 py-3 text-right">AVIS</th>
                    <th className="px-5 py-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {MEDICAMENTO_CATEGORIAS.map((cat) => {
                    const rows = filasStock.filter((f) => f.categoria === cat);
                    if (rows.length === 0) return null;
                    const itemsCount = rows.length;
                    return (
                      <Fragment key={cat}>
                        <tr className="border-b border-border bg-muted/50">
                          <td colSpan={7} className="px-5 py-2.5 bg-muted/10">
                            <div className="flex items-center justify-between text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              <span>{etiquetaMedicamentoCategoria[cat]}</span>
                              <span className="font-mono text-[10px] font-semibold text-muted-foreground/80 bg-muted/95 px-2 py-0.5 rounded-full border border-border/60 normal-case tracking-normal">
                                {itemsCount} {itemsCount === 1 ? "ítem" : "ítems"}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {rows.map((f) => {
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
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href={descuentoMesHref}
          className={cn(buttonVariants({ variant: "default" }), "w-fit text-xs font-semibold px-4.5 h-10 shadow-sm hover:shadow transition-all")}
        >
          {puedeRegistrarDescuentos ? "Registrar descuento" : "Ver descuento / stock"}
        </Link>
        <Link
          href={`/postas/${postaId}/ingresos`}
          className={cn(buttonVariants({ variant: "secondary" }), "w-fit text-xs font-semibold px-4.5 h-10 border border-border/80")}
        >
          {puedeRegistrarIngresosYAvis ? "Registrar ingreso" : "Ver ingresos"}
        </Link>
        <Link
          href={`/postas/${postaId}/avis`}
          className={cn(buttonVariants({ variant: "secondary" }), "w-fit text-xs font-semibold px-4.5 h-10 border border-border/80")}
        >
          Stock AVIS
        </Link>
        <Link
          href={`/postas/${postaId}/pedidos`}
          className={cn(buttonVariants({ variant: "outline" }), "w-fit text-xs font-semibold px-4.5 h-10")}
        >
          Pedido mensual
        </Link>
        <div className="flex-1 min-w-[2rem]" />
        {verAdmin ? (
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost" }), "w-fit text-xs font-semibold h-10 hover:bg-muted")}
          >
            Panel supervisión
          </Link>
        ) : (
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost" }), "w-fit text-xs font-semibold h-10 hover:bg-muted")}
          >
            Inicio
          </Link>
        )}
      </div>
    </div>
  );
}
