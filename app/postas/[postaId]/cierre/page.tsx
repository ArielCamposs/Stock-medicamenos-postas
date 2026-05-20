import {
  CerrarMesButton,
  ReabrirMesForm,
} from "@/components/posta/cierre-mensual-actions";
import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  esAdminGeneral,
  puedeGestionarPedidoMensualPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import {
  anioMesActual,
  permiteCierreMensualCalendarioOperacion,
  rangoFechasMesISO,
} from "@/lib/domain/fecha-mes";
import { obtenerCierreMensualPosta } from "@/lib/posta/cierre-mensual";
import { snapshotLedgerMesPosta, type MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string | string[] }>;
};

function parseYm(raw: string | string[] | undefined): { anio: number; mes: number } {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s && typeof s === "string" && /^\d{4}-\d{2}$/.test(s.trim())) {
    const [a, m] = s.trim().split("-").map(Number);
    if (a >= 2020 && a <= 2100 && m >= 1 && m <= 12) {
      return { anio: a, mes: m };
    }
  }
  return anioMesActual();
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export default async function CierreMensualPostaPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);
  const { desde, hasta } = rangoFechasMesISO(anio, mes);
  const basePath = `/postas/${postaId}/cierre`;

  const { profile } = await requirePerfilUsuario();
  const puedeCerrar = puedeGestionarPedidoMensualPosta(profile, postaId);
  const puedeReabrir = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const [medicamentosRes, avisRes, curStockRes, movsRes, cierre] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, unidad_medida, stock_recomendado_default, stock_critico_default"
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("stock_avis_mensual")
      .select("medicamento_id, stock_avis_cantidad")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("stock_mensual_posta")
      .select("medicamento_id, stock_recomendado_config, stock_critico_config")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("movimientos_diarios_consumo")
      .select("medicamento_id, fecha, cantidad_con_avis, cantidad_sin_avis, total_dia")
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    obtenerCierreMensualPosta(supabase, postaId, anio, mes),
  ]);

  const errorCarga =
    medicamentosRes.error?.message ??
    avisRes.error?.message ??
    curStockRes.error?.message ??
    movsRes.error?.message ??
    null;

  const meds: (MedLedgerMin & {
    nombre: string;
    codigo: string;
    unidad: string;
  })[] = [];

  const medicamentos = medicamentosRes.data;
  if (Array.isArray(medicamentos)) {
    for (const row of medicamentos) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      meds.push({
        id: r.id,
        nombre: typeof r.nombre === "string" ? r.nombre : "—",
        codigo: typeof r.codigo_interno === "string" ? r.codigo_interno : "",
        unidad: typeof r.unidad_medida === "string" ? r.unidad_medida : "",
        stock_recomendado_default: toInt(r.stock_recomendado_default),
        stock_critico_default: toInt(r.stock_critico_default),
      });
    }
  }

  const avis = new Map<string, number>();
  const avisRows = avisRes.data;
  if (Array.isArray(avisRows)) {
    for (const row of avisRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        avis.set(r.medicamento_id, toInt(r.stock_avis_cantidad));
      }
    }
  }

  let filas: {
    id: string;
    nombre: string;
    codigo: string;
    unidad: string;
    cierreAnterior: number;
    ingresoMes: number;
    descuentoMes: number;
    disponible: number;
    stockAvis: number;
    diferenciaAvis: number;
    stock_critico: number;
  }[] = [];

  let errorSnapshot: string | null = null;
  if (!errorCarga) {
    try {
      const snap = await snapshotLedgerMesPosta(supabase, postaId, anio, mes, meds, {
        curStockRows: curStockRes.data ?? [],
        movsMesRows: movsRes.data ?? [],
      });
      filas = meds.map((m) => {
      const s = snap.get(m.id);
      const stockAvis = avis.get(m.id) ?? 0;
      const disponible = s?.disponible ?? 0;
      const stockCritico = s?.stock_critico ?? m.stock_critico_default;
      return {
        id: m.id,
        nombre: m.nombre,
        codigo: m.codigo,
        unidad: m.unidad,
        cierreAnterior: s?.cierre_mes_anterior ?? 0,
        ingresoMes: s?.ingreso_mes ?? 0,
        descuentoMes: s?.descuento_mes ?? 0,
        disponible,
        stockAvis,
        diferenciaAvis: stockAvis - disponible,
        stock_critico: stockCritico,
      };
    });
    } catch (e) {
      errorSnapshot =
        e instanceof Error ? e.message : "Error al calcular los totales del mes.";
    }
  }

  const errorMostrar = errorCarga ?? errorSnapshot;

  const resumen = {
    disponible: filas.reduce((acc, f) => acc + f.disponible, 0),
    avis: filas.reduce((acc, f) => acc + f.stockAvis, 0),
    diferencias: filas.filter((f) => f.diferenciaAvis !== 0).length,
    bajoCritico: filas.filter(
      (f) => f.stock_critico > 0 && f.disponible <= f.stock_critico
    ).length,
  };

  const puedeCerrarSegunCalendario =
    !cierre && puedeCerrar && permiteCierreMensualCalendarioOperacion(anio, mes);

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title={`Cierre mensual · ${tituloMesChile(anio, mes)}`}
        description="Revisión del stock según el registro frente al stock AVIS antes de cerrar el mes."
      />

      <PostaMesToolbar basePath={basePath} anio={anio} mes={mes} />

      {errorMostrar ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">No se pudo cargar el cierre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{errorMostrar}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Si el mensaje menciona una tabla o columna inexistente, aplica las migraciones de Supabase
              del proyecto (carpeta <code className="text-xs">supabase/migrations</code>).
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    {cierre ? "Cierre del mes" : "Mes en curso"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {cierre
                      ? `Cerrado el ${new Date(cierre.cerradoEn).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}`
                      : "Mientras el mes esté abierto se pueden registrar y corregir movimientos."}
                  </p>
                </div>
                {cierre ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                    Mes cerrado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Mes abierto
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cierre ? (
                <p className="text-sm text-muted-foreground">
                  Cerrado el{" "}
                  {new Date(cierre.cerradoEn).toLocaleString("es-CL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                  . Los movimientos del mes están bloqueados.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Mientras el mes esté abierto se pueden registrar y corregir movimientos.
                </p>
              )}
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl border border-sky-500/20 bg-gradient-to-tr from-sky-500/8 via-card to-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock según registro</p>
                  <p className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">{resumen.disponible}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">unidades totales calculadas</p>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-gradient-to-tr from-sky-500/8 via-card to-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock AVIS declarado</p>
                  <p className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">{resumen.avis}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">unidades contadas físicamente</p>
                </div>
                <div className={resumen.diferencias > 0
                  ? "rounded-xl border border-amber-500/30 bg-gradient-to-tr from-amber-500/10 via-card to-card p-4"
                  : "rounded-xl border border-emerald-500/20 bg-gradient-to-tr from-emerald-500/8 via-card to-card p-4"
                }>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Diferencias</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1 ${
                    resumen.diferencias > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}>{resumen.diferencias}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {resumen.diferencias === 0 ? "Sin diferencias" : "medicamentos con diferencia"}
                  </p>
                </div>
                <div className={resumen.bajoCritico > 0
                  ? "rounded-xl border border-rose-500/30 bg-gradient-to-tr from-rose-500/10 via-card to-card p-4"
                  : "rounded-xl border border-emerald-500/20 bg-gradient-to-tr from-emerald-500/8 via-card to-card p-4"
                }>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bajo nivel crítico</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1 ${
                    resumen.bajoCritico > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}>{resumen.bajoCritico}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {resumen.bajoCritico === 0 ? "Todo en niveles normales" : "requieren reposición"}
                  </p>
                </div>
              </div>
              {!cierre && puedeCerrar ? (
                <div className="space-y-2">
                  <CerrarMesButton
                    postaId={postaId}
                    anio={anio}
                    mes={mes}
                    habilitado={puedeCerrarSegunCalendario}
                  />
                  {!puedeCerrarSegunCalendario ? (
                    <p className="text-xs text-muted-foreground">
                      Solo se puede cerrar el mes el último día hábil.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {cierre && puedeReabrir ? (
                <ReabrirMesForm postaId={postaId} cierreId={cierre.id} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conciliación registro vs AVIS</CardTitle>
            </CardHeader>
            <CardContent>
              {filas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay medicamentos activos en el catálogo.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[54rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2">Medicamento</th>
                        <th className="px-2 py-2 text-right">Cierre ant.</th>
                        <th className="px-2 py-2 text-right">Ingresos</th>
                        <th className="px-2 py-2 text-right">Descuentos</th>
                        <th className="px-2 py-2 text-right">Registro</th>
                        <th className="px-2 py-2 text-right">AVIS</th>
                        <th className="px-2 py-2 text-right">Dif.</th>
                      </tr>
                    </thead>
                    <tbody>
                        {filas.map((f) => {
                          const tieneDiferencia = f.diferenciaAvis !== 0;
                          const bajoCritico = f.stock_critico > 0 && f.disponible <= f.stock_critico;
                          return (
                            <tr
                              key={f.id}
                              className={`border-b border-border/70 transition-colors ${
                                bajoCritico
                                  ? "bg-rose-500/5 dark:bg-rose-500/8"
                                  : tieneDiferencia
                                    ? "bg-amber-500/5 dark:bg-amber-500/8"
                                    : ""
                              }`}
                            >
                              <td className={`px-2 py-2.5 border-l-4 ${
                                bajoCritico
                                  ? "border-l-rose-500"
                                  : tieneDiferencia
                                    ? "border-l-amber-500"
                                    : "border-l-transparent"
                              }`}>
                                <span className="font-medium">{f.nombre}</span>
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({f.codigo} · {f.unidad})
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{f.cierreAnterior}</td>
                              <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">{f.ingresoMes > 0 ? `+${f.ingresoMes}` : f.ingresoMes}</td>
                              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{f.descuentoMes}</td>
                              <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${
                                bajoCritico ? "text-rose-600 dark:text-rose-400" : ""
                              }`}>
                                {f.disponible}
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums">{f.stockAvis}</td>
                              <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${
                                f.diferenciaAvis > 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : f.diferenciaAvis < 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                              }`}>
                                {f.diferenciaAvis > 0 ? `+${f.diferenciaAvis}` : f.diferenciaAvis}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
