import Link from "next/link";
import { Fragment } from "react";

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
    },
    {
      title: "Bajo stock crítico",
      value: nCritico.toLocaleString("es-CL"),
      hint: "Medicamentos en o bajo el mínimo",
    },
    {
      title: "Cerca del mínimo",
      value: nCerca.toLocaleString("es-CL"),
      hint: "Es recomendable revisarlos pronto",
    },
    {
      title: "Medicamentos en catálogo",
      value: nCatalogo.toLocaleString("es-CL"),
      hint: "Activos en el sistema",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Resumen del mes
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {puedeRegistrarDescuentos ? (
            <>
              Cifras del mes calendario <span className="font-medium">{etiquetaMes}</span>{" "}
              según el registro del mes (cierre anterior + ingresos − descuentos). El detalle día a
              día está en{" "}
              <Link className="underline underline-offset-4" href={descuentoMesHref}>
                Descuento
              </Link>
              .
            </>
          ) : puedeRegistrarIngresosYAvis ? (
            <>
              Puede cargar ingresos y declarar stock AVIS; el descuento diario lo registra
              el encargado. Mes en pantalla:{" "}
              <span className="font-medium">{etiquetaMes}</span>.
            </>
          ) : (
            <>
              Solo lectura. Stock del mes{" "}
              <span className="font-medium">{etiquetaMes}</span> según el registro de la
              posta.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.title} size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.title}</CardTitle>
              <CardDescription>{c.hint}</CardDescription>
            </CardHeader>
            <div className="px-4 pb-4">
              <p className="font-heading text-3xl font-semibold tabular-nums">
                {c.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">Stock posta por medicamento</CardTitle>
          <CardDescription>
            <span className="block">
              <strong>Si no existen registros, se muestra "-", "0".{" "}</strong>
            </span>
            <StockNivelLeyenda className="mt-3" compact />
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {filasStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay medicamentos activos en el catálogo.
            </p>
          ) : (
            <div className="max-h-[min(70vh,32rem)] overflow-auto rounded-md border">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b bg-muted/95 backdrop-blur-sm text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Medicamento</th>
                    <th className="px-3 py-2 text-right tabular-nums">Stock posta</th>
                    <th className="px-3 py-2 text-right tabular-nums">Mín. crítico</th>
                    <th className="px-3 py-2 text-right tabular-nums">Disponible</th>
                    <th className="px-3 py-2 text-right tabular-nums">AVIS</th>
                    <th className="hidden w-[1%] whitespace-nowrap px-3 py-2 sm:table-cell">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MEDICAMENTO_CATEGORIAS.map((cat) => {
                    const rows = filasStock.filter((f) => f.categoria === cat);
                    if (rows.length === 0) return null;
                    return (
                      <Fragment key={cat}>
                        <tr className="border-b border-border bg-muted/85">
                          <td
                            colSpan={6}
                            className="px-3 py-2 text-xs font-semibold tracking-wide text-foreground"
                          >
                            {etiquetaMedicamentoCategoria[cat]}
                          </td>
                        </tr>
                        {rows.map((f) => {
                          const rowBg =
                            f.tono === "alerta"
                              ? f.nivel === "critico"
                                ? "bg-destructive/16 dark:bg-destructive/22"
                                : "bg-destructive/9 dark:bg-destructive/14"
                              : f.tono === "regular"
                                ? "bg-amber-400/16 dark:bg-amber-500/12"
                                : "bg-emerald-500/11 dark:bg-emerald-500/10";
                          const bordeIzq =
                            f.tono === "alerta"
                              ? "border-l-4 border-l-destructive"
                              : f.tono === "regular"
                                ? "border-l-4 border-l-amber-500"
                                : "border-l-4 border-l-emerald-600";
                          const claseDisponible =
                            f.tono === "alerta"
                              ? "text-destructive"
                              : f.tono === "regular"
                                ? "text-amber-950 dark:text-amber-100"
                                : "text-emerald-900 dark:text-emerald-100";
                          return (
                            <tr
                              key={f.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td
                                className={cn(
                                  "px-3 py-2 font-medium",
                                  rowBg,
                                  bordeIzq
                                )}
                              >
                                {f.nombre}
                                {f.unidad ? (
                                  <span className="ml-1 font-normal text-muted-foreground">
                                    ({f.unidad})
                                  </span>
                                ) : null}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right tabular-nums",
                                  rowBg
                                )}
                              >
                                {f.stockFichaMes === null
                                  ? "—"
                                  : f.stockFichaMes.toLocaleString("es-CL")}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right tabular-nums text-muted-foreground",
                                  rowBg
                                )}
                              >
                                {f.stockCrit.toLocaleString("es-CL")}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right font-medium tabular-nums",
                                  rowBg,
                                  claseDisponible
                                )}
                              >
                                {f.disponible.toLocaleString("es-CL")}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right font-medium tabular-nums text-sky-900 dark:text-sky-100",
                                  rowBg
                                )}
                              >
                                {f.stockAvis.toLocaleString("es-CL")}
                              </td>
                              <td
                                className={cn(
                                  "hidden px-3 py-2 sm:table-cell",
                                  rowBg
                                )}
                              >
                                {f.nivel === "critico" ? (
                                  <Badge variant="destructive">Crítico</Badge>
                                ) : f.nivel === "cerca" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-destructive/55 bg-destructive/12 font-medium text-destructive dark:border-destructive/50 dark:bg-destructive/20 dark:text-red-100"
                                  >
                                    Cerca del mín.
                                  </Badge>
                                ) : f.tono === "regular" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-600/45 bg-amber-400/20 font-medium text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-50"
                                  >
                                    Regular
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-600/45 bg-emerald-500/15 font-medium text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-400/12 dark:text-emerald-50"
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
          <p className="mt-3 text-xs text-muted-foreground">
            Orden: categoría del catálogo, luego alerta → regular → bien, y dentro de cada
            grupo por menor disponible y nombre. Detalle día a día en{" "}
            <Link className="underline underline-offset-2" href={descuentoMesHref}>
              Descuento
            </Link>
            .
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link
          href={descuentoMesHref}
          className={cn(buttonVariants({ variant: "default" }), "w-fit")}
        >
          {puedeRegistrarDescuentos ? "Registrar descuento" : "Ver descuento / stock"}
        </Link>
        <Link
          href={`/postas/${postaId}/ingresos`}
          className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}
        >
          {puedeRegistrarIngresosYAvis ? "Registrar ingreso" : "Ver ingresos"}
        </Link>
        <Link
          href={`/postas/${postaId}/avis`}
          className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}
        >
          Stock AVIS
        </Link>
        <Link
          href={`/postas/${postaId}/pedidos`}
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          Pedido mensual
        </Link>
        {verAdmin ? (
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost" }), "w-fit")}
          >
            Panel supervisión
          </Link>
        ) : (
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost" }), "w-fit")}
          >
            Inicio
          </Link>
        )}
      </div>
    </div>
  );
}
