import Link from "next/link";
import { Package, AlertTriangle, TrendingUp, Activity } from "lucide-react";

import {
  StockInsumosDashboard,
  type FilaStockInsumoDashboard,
} from "@/components/posta/stock-insumos-dashboard";
import { StockTablaDashboard, type FilaStockTabla } from "@/components/posta/stock-tabla-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  puedeRegistrarOperacionesPosta,
  puedeRegistrarIngresosPosta,
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
  indiceOrdenCategoria,
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
  const puedeRegistrarIngresos = puedeRegistrarIngresosPosta(profile, postaId);
  const puedeRegistrarAvis = puedeRegistrarStockYAvisPosta(profile, postaId);
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

  const insumosHref = `/postas/${postaId}/insumos`;

  const [{ data: medicamentos }, { data: curStock }, { data: movs }, { data: avisRows }, { data: insumos }, { data: stockInsumosRows }] =
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
      supabase
        .from("insumos")
        .select("id, nombre, unidad_medida, stock_objetivo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase
        .from("stock_insumos_posta")
        .select("insumo_id, cantidad")
        .eq("posta_id", postaId),
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
  const medicamentosCriticos = filasStock
    .filter((f) => f.nivel === "critico")
    .map((f) => f.nombre);

  const stockInsumosPorId = new Map<string, number>();
  if (Array.isArray(stockInsumosRows)) {
    for (const row of stockInsumosRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.insumo_id !== "string") continue;
      const n = Number(r.cantidad);
      stockInsumosPorId.set(
        r.insumo_id,
        Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
      );
    }
  }

  const filasStockInsumos: FilaStockInsumoDashboard[] = [];
  if (Array.isArray(insumos)) {
    for (const row of insumos) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.nombre !== "string") continue;
      const stockObjetivo = Number(r.stock_objetivo);
      const objetivo = Number.isFinite(stockObjetivo) ? Math.max(0, Math.trunc(stockObjetivo)) : 0;
      const registrado = stockInsumosPorId.has(r.id);
      const cantidad = registrado ? (stockInsumosPorId.get(r.id) ?? 0) : null;
      const disp = cantidad ?? 0;
      const nivel = cantidad === null ? null : nivelAlertaStock(disp, 0, objetivo);
      const tono =
        cantidad === null ? ("regular" as const) : nivelStockListadoVisual(disp, 0, objetivo);
      filasStockInsumos.push({
        id: r.id,
        nombre: r.nombre,
        unidad: typeof r.unidad_medida === "string" ? r.unidad_medida : "unidad",
        stockObjetivo: objetivo,
        cantidad,
        nivel,
        tono,
      });
    }
  }

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
      criticalList: medicamentosCriticos,
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
              ) : puedeRegistrarAvis && !puedeRegistrarIngresos ? (
                <>
                  Puede declarar stock AVIS; los ingresos y el descuento diario los registra el
                  encargado. Mes en pantalla:{" "}
                  <span className="font-semibold text-foreground">{etiquetaMes}</span>.
                </>
              ) : puedeRegistrarIngresos ? (
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
          const hasCriticos = nCritico > 0;
          const isCritical = c.color === "destructive" && c.count && c.count > 0;
          const isWarning = c.color === "amber" && c.count && c.count > 0;
          
          let cardBgClass = "bg-card border-border/80 hover:border-border hover:shadow-sm";
          let iconWrapperClass = "text-muted-foreground";
          let valueClass = "text-foreground";
          let colSpanClass = "sm:col-span-1 lg:col-span-1";
          
          if (c.color === "primary") {
            iconWrapperClass = "text-sky-600 dark:text-sky-400";
            valueClass = "text-sky-700 dark:text-sky-400";
            if (hasCriticos) {
              colSpanClass = "sm:col-span-2 lg:col-span-2";
            }
          } else if (c.color === "destructive") {
            if (isCritical) {
              cardBgClass = "bg-gradient-to-br from-rose-500/[0.03] to-card border-rose-500/30 hover:border-rose-500/45 hover:shadow-sm";
              iconWrapperClass = "text-rose-600 dark:text-rose-400 animate-pulse";
              valueClass = "text-rose-600 dark:text-rose-400";
              colSpanClass = "sm:col-span-2 lg:col-span-2";
            } else {
              iconWrapperClass = "text-muted-foreground/60";
              valueClass = "text-muted-foreground/50";
            }
          } else if (c.color === "amber") {
            if (isWarning) {
              cardBgClass = "bg-gradient-to-br from-amber-500/[0.01] to-card border-amber-500/30 hover:border-amber-500/45 hover:shadow-sm";
              iconWrapperClass = "text-amber-600 dark:text-amber-400";
              valueClass = "text-amber-600 dark:text-amber-400";
              if (hasCriticos) {
                colSpanClass = "sm:col-span-1 lg:col-span-2";
              }
            } else {
              iconWrapperClass = "text-muted-foreground/60";
              valueClass = "text-muted-foreground/50";
              if (hasCriticos) {
                colSpanClass = "sm:col-span-1 lg:col-span-2";
              }
            }
          } else if (c.color === "info") {
            iconWrapperClass = "text-emerald-600 dark:text-emerald-400";
            valueClass = "text-emerald-700 dark:text-emerald-400";
            if (hasCriticos) {
              colSpanClass = "sm:col-span-1 lg:col-span-2";
            }
          }

          return (
            <Card 
              key={c.title} 
              size="sm" 
              className={cn(
                "overflow-hidden border transition-all duration-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md",
                cardBgClass,
                colSpanClass
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{c.title}</span>
                  <div className={cn("shrink-0 transition-transform group-hover:scale-105", iconWrapperClass)}>
                    <Icon className="size-5" />
                  </div>
                </div>
                
                <div className="mt-2.5">
                  <p className={cn("font-heading text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums", valueClass)}>
                    {c.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/80 leading-normal">{c.hint}</p>
                </div>
              </div>

              {isCritical && c.criticalList && c.criticalList.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-rose-500/15">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                    Críticos actuales:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.criticalList.slice(0, 4).map((name) => (
                      <span key={name} className="inline-flex items-center rounded-lg bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300 border border-rose-500/15 truncate max-w-[200px]">
                        {name}
                      </span>
                    ))}
                    {c.criticalList.length > 4 && (
                      <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground border">
                        +{c.criticalList.length - 4} más
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <StockTablaDashboard filas={filasStock} descuentoMesHref={descuentoMesHref} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <p className="text-xs text-muted-foreground">
            Stock declarado por la posta · pedidos en la sección Insumos
          </p>
          <Link
            href={insumosHref}
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ir a Insumos
          </Link>
        </div>
        <StockInsumosDashboard
          postaId={postaId}
          filas={filasStockInsumos}
          puedeEditar={false}
          embebido
        />
      </div>

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
          {puedeRegistrarIngresos ? "Registrar ingreso" : "Ver ingresos"}
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
        <Link
          href={`/postas/${postaId}/insumos`}
          className={cn(buttonVariants({ variant: "outline" }), "w-fit text-xs font-semibold px-4.5 h-10")}
        >
          Insumos
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
