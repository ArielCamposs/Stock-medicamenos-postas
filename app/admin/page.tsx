import Link from "next/link";
import { 
  Activity, 
  AlertTriangle, 
  LayoutGrid, 
  Package, 
  Landmark, 
  CheckCircle, 
  FileSpreadsheet, 
  Layers, 
  ArrowLeft 
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import {
  etiquetaFechaCalendarioDDMMYYYY,
  fechaCalendarioEnZonaIANA,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";
import { postasConAlertaDeStock } from "@/lib/posta/admin-stock-alerta-postas";
import type { MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Siempre datos frescos (evita sensación de “pantalla vieja” por caché). */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { profile } = await requirePerfilUsuario();
  const supabase = await createServerSupabaseClient();
  const puedeCatalogo = esAdminGeneral(profile);

  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const hoyEtiqueta = etiquetaFechaCalendarioDDMMYYYY(hoy);
  const [anioStockStr, mesStockStr] = hoy.split("-");
  const anioStock = Number(anioStockStr);
  const mesStock = Number(mesStockStr);
  const [{ data: listaPostas }, { count: nMedicamentosActivos }, { data: medsActivos }] =
    await Promise.all([
      supabase
        .from("postas")
        .select("id, nombre, codigo")
        .eq("activa", true)
        .order("nombre"),
      supabase
        .from("medicamentos")
        .select("*", { count: "exact", head: true })
        .eq("activo", true),
      supabase
        .from("medicamentos")
        .select("id, stock_recomendado_default, stock_critico_default")
        .eq("activo", true),
    ]);

  const postas = listaPostas ?? [];
  const meta =
    nMedicamentosActivos !== null && nMedicamentosActivos !== undefined
      ? Number(nMedicamentosActivos)
      : 0;

  const medsLedger: MedLedgerMin[] = [];
  if (medsActivos && Array.isArray(medsActivos)) {
    for (const row of medsActivos) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      const rec = Number(r.stock_recomendado_default);
      const crit = Number(r.stock_critico_default);
      medsLedger.push({
        id: r.id,
        stock_recomendado_default: Number.isFinite(rec) ? Math.max(0, Math.trunc(rec)) : 0,
        stock_critico_default: Number.isFinite(crit) ? Math.max(0, Math.trunc(crit)) : 0,
      });
    }
  }

  const postasParaStock = postas.map((p) => ({
    id: p.id as string,
    nombre: String(p.nombre ?? ""),
    codigo: p.codigo === null || typeof p.codigo === "string" ? p.codigo : null,
  }));

  const [filas, alertasStock] = await Promise.all([
    Promise.all(
      postas.map(async (p) => {
        const id = p.id as string;
        const [{ count: descuentosHoyCount }, { count: ingresosHoy }] =
          await Promise.all([
            supabase
              .from("movimientos_diarios_consumo")
              .select("id", { count: "exact", head: true })
              .eq("posta_id", id)
              .eq("anulado", false)
              .eq("fecha", hoy),
            supabase
              .from("ingresos_stock_mes")
              .select("id", { count: "exact", head: true })
              .eq("posta_id", id)
              .eq("anulado", false)
              .eq("fecha", hoy),
          ]);

        const cHoy = descuentosHoyCount ?? 0;
        let estadoDescuento: "vacío" | "parcial" | "ok" | "na" = "na";
        if (meta <= 0) {
          estadoDescuento = "na";
        } else if (cHoy === 0) {
          estadoDescuento = "vacío";
        } else if (cHoy < meta) {
          estadoDescuento = "parcial";
        } else {
          estadoDescuento = "ok";
        }

        return {
          id,
          nombre: String(p.nombre ?? ""),
          codigo: p.codigo ? String(p.codigo) : null,
          descuentosHoy: cHoy,
          ingresosHoy: ingresosHoy ?? 0,
          estadoDescuento,
        };
      })
    ),
    postasParaStock.length > 0 &&
    medsLedger.length > 0 &&
    Number.isFinite(anioStock) &&
    Number.isFinite(mesStock)
      ? postasConAlertaDeStock(supabase, postasParaStock, medsLedger, anioStock, mesStock)
      : Promise.resolve([]),
  ]);

  const sinDescuentoHoy = filas.filter((f) => f.estadoDescuento === "vacío").length;

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-tr from-primary/5 via-card to-card px-5 py-8 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-48 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex items-center justify-center text-primary">
              <Activity className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Panel de administración general
              </p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
                Supervisión de todas las postas
              </h1>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/85 px-4 py-3 text-center shadow-sm backdrop-blur-sm sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Fecha de hoy
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground mt-0.5">
              {hoyEtiqueta}
            </p>
          </div>
        </div>

        <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-4 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.02] to-card p-5 shadow-sm hover:border-sky-500/35 hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Postas activas</span>
              <div className="flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Landmark className="size-5" />
              </div>
            </div>
            <div>
              <p className="font-heading text-3xl font-extrabold tracking-tight text-sky-700 dark:text-sky-400 tabular-nums">
                {postas.length}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1">Sedes registradas en el sistema</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.01] to-card p-5 shadow-sm hover:border-emerald-500/35 hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Medicamentos en catálogo</span>
              <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Package className="size-5" />
              </div>
            </div>
            <div>
              <p className="font-heading text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
                {meta}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1">Medicamentos e insumos activos</p>
            </div>
          </div>

          <div className={cn(
            "flex flex-col gap-4 rounded-xl border p-5 shadow-sm transition-all hover:shadow-md",
            sinDescuentoHoy > 0
              ? "border-rose-500/20 bg-gradient-to-br from-rose-500/[0.03] to-card hover:border-rose-500/35"
              : "border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.01] to-card hover:border-emerald-500/35"
          )}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sin descuento hoy</span>
              <div className={cn(
                "flex items-center justify-center",
                sinDescuentoHoy > 0
                  ? "text-rose-600 dark:text-rose-400 animate-pulse"
                  : "text-emerald-600 dark:text-emerald-400"
              )}>
                <Activity className="size-5" />
              </div>
            </div>
            <div>
              <p className={cn(
                "font-heading text-3xl font-extrabold tracking-tight tabular-nums",
                sinDescuentoHoy > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              )}>
                {sinDescuentoHoy}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                {sinDescuentoHoy === 1 ? "Posta pendiente de registrar" : "Postas pendientes de registrar"}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/admin/pedidos"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-border/80 bg-card/90 hover:bg-accent text-xs font-medium text-foreground"
            )}
          >
            <Layers className="size-3.5 mr-1.5" />
            Ver pedidos mensuales enviados
          </Link>
          <a
            href={`/api/reportes/stock-mensual?ym=${anioStock}-${String(mesStock).padStart(2, "0")}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-border/80 bg-card/90 hover:bg-accent text-xs font-medium text-foreground"
            )}
          >
            <FileSpreadsheet className="size-3.5 mr-1.5" />
            Exportar stock mensual
          </a>
        </div>
      </section>

      <Card className="overflow-hidden border border-border/80 bg-card/40 shadow-sm backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="size-4.5 text-primary" />
            Seguimiento del día ·{" "}
            <span className="font-mono font-normal text-muted-foreground">{hoyEtiqueta}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                </svg>
              </div>
              <h3 className="font-heading text-sm font-semibold text-foreground">Sin postas activas</h3>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-[280px]">
                No hay centros de salud habilitados en la base de datos.
                {puedeCatalogo ? " Registre una nueva posta en el catálogo." : ""}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm text-left">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-3.5">Posta</th>
                      <th className="px-6 py-3.5 text-right">Descuentos hoy</th>
                      <th className="px-6 py-3.5 text-right">Ingresos hoy</th>
                      <th className="px-6 py-3.5">Estado descuento</th>
                      <th className="px-6 py-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filas.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-muted/30 transition-colors duration-150"
                      >
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground">{row.nombre}</span>
                          {row.codigo ? (
                            <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {row.codigo}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className="tabular-nums font-semibold text-foreground w-8 text-right shrink-0">
                              {row.descuentosHoy}
                            </span>
                            <div className="hidden sm:flex items-center gap-1.5 w-16 shrink-0">
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    row.estadoDescuento === "ok"
                                      ? "bg-emerald-500"
                                      : row.estadoDescuento === "parcial"
                                        ? "bg-amber-500"
                                        : "bg-destructive"
                                  )}
                                  style={{ width: `${meta > 0 ? (row.descuentosHoy / meta) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-muted-foreground/60 w-6 text-right shrink-0">
                                {meta > 0 ? Math.min(100, Math.round((row.descuentosHoy / meta) * 100)) : 0}%
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums font-medium text-muted-foreground">
                          {row.ingresosHoy}
                        </td>
                        <td className="px-6 py-4">
                          {row.estadoDescuento === "na" ? (
                            <span className="text-muted-foreground font-mono">—</span>
                          ) : row.estadoDescuento === "vacío" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                              <span className="size-1.5 rounded-full bg-destructive" />
                              Sin registros
                            </span>
                          ) : row.estadoDescuento === "parcial" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              Parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Completo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/postas/${row.id}/dashboard`}
                            className={cn(
                              buttonVariants({ variant: "secondary", size: "sm" }),
                              "h-8 text-xs font-medium"
                            )}
                          >
                            Ver sede
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden divide-y divide-border/40">
                {filas.map((row) => (
                  <div key={row.id} className="p-4 flex flex-col gap-3 bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-foreground block truncate">{row.nombre}</span>
                        {row.codigo && (
                          <span className="inline-flex mt-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground font-bold uppercase leading-none">
                            {row.codigo}
                          </span>
                        )}
                      </div>
                      
                      {row.estadoDescuento === "na" ? (
                        <span className="text-muted-foreground font-mono text-xs">—</span>
                      ) : row.estadoDescuento === "vacío" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          <span className="size-1.5 rounded-full bg-destructive" />
                          Sin registros
                        </span>
                      ) : row.estadoDescuento === "parcial" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          Parcial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Completo
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 px-2.5 bg-muted/30 rounded-xl border border-border/30 text-center">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Descuentos hoy</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5 tabular-nums">{row.descuentosHoy}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Ingresos hoy</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5 tabular-nums">{row.ingresosHoy}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs pt-1">
                      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              row.estadoDescuento === "ok"
                                ? "bg-emerald-500"
                                : row.estadoDescuento === "parcial"
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                            )}
                            style={{ width: `${meta > 0 ? (row.descuentosHoy / meta) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground font-bold">
                          {meta > 0 ? Math.min(100, Math.round((row.descuentosHoy / meta) * 100)) : 0}%
                        </span>
                      </div>
                      <Link
                        href={`/postas/${row.id}/dashboard`}
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                          "h-7 text-[11px] px-2.5 font-semibold shrink-0"
                        )}
                      >
                        Ver sede
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className={cn(
        "overflow-hidden border shadow-sm backdrop-blur-sm transition-all duration-300",
        alertasStock.length > 0 
          ? "border-amber-500/30 bg-amber-500/5" 
          : "border-border/80 bg-card/40"
      )}>
        <CardHeader className={cn(
          "border-b px-6 py-4.5",
          alertasStock.length > 0
            ? "border-amber-500/20 bg-amber-500/10 dark:bg-amber-950/20"
            : "border-border/60 bg-muted/20"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center",
              alertasStock.length > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            )}>
              <AlertTriangle className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Stock bajo o cerca del crítico</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {alertasStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 py-14 text-center text-muted-foreground animate-fade-in">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-500/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-7 text-emerald-500"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-heading text-sm font-semibold text-foreground">Niveles estables</h3>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-[340px]">
                Ninguna posta tiene medicamentos en estado de stock crítico o bajo el mínimo en este período.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm text-left">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-3.5">Posta</th>
                      <th className="px-6 py-3.5 text-center">≤ crítico</th>
                      <th className="px-6 py-3.5 text-center">Cerca</th>
                      <th className="px-6 py-3.5 text-right">Peor margen</th>
                      <th className="px-6 py-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {alertasStock.map((row) => (
                      <tr
                        key={row.postaId}
                        className="hover:bg-muted/30 transition-colors duration-150"
                      >
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground">{row.postaNombre}</span>
                          {row.postaCodigo ? (
                            <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {row.postaCodigo}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-center tabular-nums">
                          {row.nCritico > 0 ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-0.5 text-xs font-bold text-destructive">
                              {row.nCritico}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs font-medium">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center tabular-nums">
                          {row.nCerca > 0 ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                              {row.nCerca}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs font-medium">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          <span
                            className={cn(
                              "font-semibold",
                              row.minMargen < 0
                                ? "text-destructive"
                                : "text-foreground"
                            )}
                          >
                            {row.minMargen > 0 ? "+" : ""}
                            {row.minMargen}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground font-light">u. sobre crít.</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/postas/${row.postaId}/ingresos`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                              "h-8 text-xs hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 font-medium"
                            )}
                          >
                            Ver ingresos
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden divide-y divide-border/40">
                {alertasStock.map((row) => (
                  <div key={row.postaId} className="p-4 flex flex-col gap-3.5 bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-foreground block truncate">{row.postaNombre}</span>
                        {row.postaCodigo && (
                          <span className="inline-flex mt-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground font-bold uppercase leading-none">
                            {row.postaCodigo}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {row.nCritico > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[9px] font-bold text-destructive uppercase tracking-wider">
                            {row.nCritico} Críticos
                          </span>
                        ) : null}
                        {row.nCerca > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                            {row.nCerca} Bajos
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-border/30">
                      <div className="text-xs text-muted-foreground">
                        Peor margen:{" "}
                        <span className={cn("font-bold text-sm tabular-nums", row.minMargen < 0 ? "text-destructive" : "text-foreground")}>
                          {row.minMargen > 0 ? "+" : ""}
                          {row.minMargen}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 font-normal ml-0.5">u. sobre crít.</span>
                      </div>
                      <Link
                        href={`/postas/${row.postaId}/ingresos`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-7 text-[11px] px-2.5 font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shrink-0 border border-amber-500/15"
                        )}
                      >
                        Ver ingresos
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {puedeCatalogo ? (
        <section className="space-y-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-6">
          <div>
            <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              Configuración de Catálogos
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/postas"
              className="group block rounded-xl outline-none"
            >
              <Card className="h-full border border-border/60 bg-card/30 hover:bg-card hover:border-primary/45 transition-all duration-200 shadow-sm hover:shadow">
                <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold text-foreground">Gestión de Postas</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 truncate">Administrar sedes activas, códigos y configuraciones.</p>
                  </div>
                  <Landmark className="size-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
              </Card>
            </Link>

            <Link
              href="/admin/medicamentos"
              className="group block rounded-xl outline-none"
            >
              <Card className="h-full border border-border/60 bg-card/30 hover:bg-card hover:border-primary/45 transition-all duration-200 shadow-sm hover:shadow">
                <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold text-foreground">Catálogo de Medicamentos</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 truncate">Configurar medicamentos activos, dosis y stocks default.</p>
                  </div>
                  <Package className="size-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
