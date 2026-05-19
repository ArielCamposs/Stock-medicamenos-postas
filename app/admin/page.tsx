import Link from "next/link";
import { Activity, AlertTriangle, LayoutGrid, Package } from "lucide-react";

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
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background px-5 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Activity className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Panel de administración general
              </p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
                Supervisión de todas las postas
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Resumen por posta para el día calendario(
                {ZONA_CALENDARIO_OPERACION}). Los registros los carga cada encargado en su
                sede.
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-background/80 px-4 py-3 text-center shadow-sm backdrop-blur-sm sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Fecha de hoy
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {hoyEtiqueta}
            </p>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
            <LayoutGrid className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Postas activas</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {postas.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
            <Package className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Medicamentos en catálogo</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {meta}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
            <Activity className="size-5 shrink-0 text-destructive/80" />
            <div>
              <p className="text-xs text-muted-foreground">Sin descuento registrado hoy</p>
              <p className="font-heading text-2xl font-semibold tabular-nums text-destructive">
                {sinDescuentoHoy}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-4">
          <Link
            href="/admin/pedidos"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-primary/25 bg-background/90"
            )}
          >
            Ver pedidos mensuales enviados
          </Link>
          <a
            href={`/api/reportes/stock-mensual?ym=${anioStock}-${String(mesStock).padStart(2, "0")}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "ml-2 border-primary/25 bg-background/90"
            )}
          >
            Exportar stock mensual
          </a>
        </div>
      </section>

      <Card className="overflow-hidden border-2 shadow-md">
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="text-lg">
            Seguimiento del día ·{" "}
            <span className="font-mono font-normal">{hoyEtiqueta}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {filas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay postas activas.{" "}
              {puedeCatalogo
                ? "Crea postas desde «Postas» en el menú superior."
                : null}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-3">Posta</th>
                    <th className="px-3 py-3 text-right">Descuentos hoy</th>
                    <th className="px-3 py-3 text-right">Ingresos hoy</th>
                    <th className="px-3 py-3">Estado descuento</th>
                    <th className="px-3 py-3">Sede</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-3 py-3">
                        <span className="font-medium">{row.nombre}</span>
                        {row.codigo ? (
                          <span className="ml-1 text-muted-foreground">
                            ({row.codigo})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.descuentosHoy}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.ingresosHoy}
                      </td>
                      <td className="px-3 py-3">
                        {row.estadoDescuento === "na" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : row.estadoDescuento === "vacío" ? (
                          <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">
                            Sin registros hoy
                          </span>
                        ) : row.estadoDescuento === "parcial" ? (
                          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
                            Parcial ({row.descuentosHoy}/{meta})
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-100">
                            Completo ({row.descuentosHoy}/{meta})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/postas/${row.id}/dashboard`}
                          className={cn(
                            buttonVariants({ variant: "secondary", size: "sm" }),
                            "h-8"
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
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-2 border-amber-500/25 shadow-md">
        <CardHeader className="border-b bg-amber-500/10 dark:bg-amber-950/25">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/25 text-amber-900 dark:text-amber-100">
              <AlertTriangle className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Stock bajo o cerca del crítico</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {alertasStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna posta con medicamentos en zona crítica o cerca del crítico en este
              mes, o todavía no hay movimientos registrados para armar el saldo.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-3">Posta</th>
                    <th className="px-3 py-3 text-right">≤ crítico</th>
                    <th className="px-3 py-3 text-right">Cerca</th>
                    <th className="px-3 py-3 text-right">Peor margen</th>
                    <th className="px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasStock.map((row) => (
                    <tr
                      key={row.postaId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-3 py-3">
                        <span className="font-medium">{row.postaNombre}</span>
                        {row.postaCodigo ? (
                          <span className="ml-1 text-muted-foreground">
                            ({row.postaCodigo})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.nCritico > 0 ? (
                          <span className="rounded-md bg-destructive/15 px-2 py-0.5 font-medium text-destructive">
                            {row.nCritico}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.nCerca > 0 ? (
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-100">
                            {row.nCerca}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span
                          className={cn(
                            row.minMargen < 0
                              ? "font-semibold text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {row.minMargen > 0 ? "+" : ""}
                          {row.minMargen}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">u. sobre crít.</span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/postas/${row.postaId}/ingresos`}
                          className={cn(
                            buttonVariants({ variant: "secondary", size: "sm" }),
                            "h-8"
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
          )}
        </CardContent>
      </Card>

      {puedeCatalogo ? (
        <section className="space-y-4 rounded-2xl border border-dashed bg-muted/20 px-5 py-6 sm:px-6">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Configuración
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/postas"
              className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">Postas</CardTitle>
                </CardHeader>
              </Card>
            </Link>

            <Link
              href="/admin/medicamentos"
              className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">Medicamentos</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>
      ) : null}

      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "inline-flex w-fit")}
      >
        Inicio
      </Link>
    </div>
  );
}
