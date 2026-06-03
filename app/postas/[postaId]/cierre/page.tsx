import {
  CerrarMesButton,
  ReabrirMesForm,
} from "@/components/posta/cierre-mensual-actions";
import {
  CierreConciliacionTabla,
  CierreResumenTarjetas,
} from "@/components/posta/cierre-conciliacion-tabla";
import { HistorialCierresMensuales } from "@/components/posta/historial-cierres-mensuales";
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
} from "@/lib/domain/fecha-mes";
import {
  cargarVistaCierreMes,
  listarHistorialCierresMensualesPosta,
} from "@/lib/posta/cierre-mensual";
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

export default async function CierreMensualPostaPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);
  const basePath = `/postas/${postaId}/cierre`;

  const { profile } = await requirePerfilUsuario();
  const puedeCerrar = puedeGestionarPedidoMensualPosta(profile, postaId);
  const puedeReabrir = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const [vistaResult, historialResult] = await Promise.all([
    cargarVistaCierreMes(supabase, postaId, anio, mes).catch(
      (e): { error: string } => ({
        error: e instanceof Error ? e.message : "Error al cargar el cierre del mes.",
      })
    ),
    listarHistorialCierresMensualesPosta(supabase, postaId).catch(
      (e): { error: string } => ({
        error: e instanceof Error ? e.message : "No se pudo cargar el historial.",
      })
    ),
  ]);

  const historial = "error" in historialResult ? [] : historialResult;
  const errorHistorial =
    "error" in historialResult ? historialResult.error : null;

  const errorMostrar = "error" in vistaResult ? vistaResult.error : null;
  const cierre = "error" in vistaResult ? null : vistaResult.cierre;
  const filas = "error" in vistaResult ? [] : vistaResult.filas;
  const resumen = "error" in vistaResult
    ? { disponible: 0, avis: 0, diferencias: 0, bajoCritico: 0 }
    : vistaResult.resumen;
  const origenVista = "error" in vistaResult ? "calculado" : vistaResult.origen;

  const puedeCerrarSegunCalendario =
    !cierre && puedeCerrar && permiteCierreMensualCalendarioOperacion(anio, mes);

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title={`Cierre mensual · ${tituloMesChile(anio, mes)}`}
        description="Revisión del stock según el registro frente al stock AVIS antes de cerrar el mes."
      />

      <PostaMesToolbar
        basePath={basePath}
        anio={anio}
        mes={mes}
        mesCerrado={Boolean(cierre)}
      />

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
                  {cierre ? (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Cerrado el{" "}
                      {new Date(cierre.cerradoEn).toLocaleString("es-CL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      . Los movimientos del mes están bloqueados.
                    </p>
                  ) : null}
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
              {!cierre ? (
                <p className="text-sm text-muted-foreground">
                  Mientras el mes esté abierto se pueden registrar y corregir movimientos.
                </p>
              ) : null}
              <CierreResumenTarjetas resumen={resumen} />
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
              {cierre && origenVista === "snapshot" ? (
                <p className="text-sm font-normal text-muted-foreground">
                  Valores guardados al cerrar el mes (no se recalculan con datos actuales).
                </p>
              ) : cierre && origenVista === "calculado" ? (
                <p className="text-sm font-normal text-amber-800 dark:text-amber-200">
                  Este mes está cerrado, pero no hay detalle guardado en el historial. La tabla
                  siguiente se calcula con los datos actuales y puede diferir del cierre original.
                </p>
              ) : (
                <p className="text-sm font-normal text-muted-foreground">
                  Totales según el registro del mes (cierre anterior + ingresos − descuentos).
                </p>
              )}
            </CardHeader>
            <CardContent>
              <CierreConciliacionTabla filas={filas} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de cierres</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Todos los cierres realizados en esta posta. Abre un mes para ver la tabla guardada al
            cerrar.
          </p>
        </CardHeader>
        <CardContent>
          {errorHistorial ? (
            <p className="text-sm text-destructive">{errorHistorial}</p>
          ) : (
            <HistorialCierresMensuales postaId={postaId} items={historial} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
