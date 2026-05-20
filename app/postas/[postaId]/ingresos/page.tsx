import { PackagePlus, History, Lock } from "lucide-react";
import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import {
  IngresoStockLoteForm,
  type LedgerIngresoFila,
} from "@/components/posta/ingreso-stock-lote-form";
import { UltimosIngresosTabla } from "@/components/posta/ultimos-ingresos-acciones";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  puedeRegistrarStockYAvisPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { anioMesActual } from "@/lib/domain/fecha-mes";
import { obtenerCierreMensualPosta } from "@/lib/posta/cierre-mensual";
import { snapshotLedgerMesPosta } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string }>;
};

function parseYm(raw: string | undefined): { anio: number; mes: number } {
  if (raw && typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw.trim())) {
    const [a, m] = raw.trim().split("-").map(Number);
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

const ORIGEN_LABEL: Record<string, string> = {
  COMPRA: "Compra",
  TRASLADO: "Traslado",
  AJUSTE: "Ajuste",
  OTRO: "Otro",
};

export default async function PostaIngresosPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);
  const mesContableYm = `${anio}-${String(mes).padStart(2, "0")}`;

  const { profile } = await requirePerfilUsuario();
  const puedeRegistrarPorRol = puedeRegistrarStockYAvisPosta(profile, postaId);
  const supabase = await createServerSupabaseClient();
  const cierre = await obtenerCierreMensualPosta(supabase, postaId, anio, mes);
  const puedeRegistrar = puedeRegistrarPorRol && !cierre;

  const [{ data: medicamentos }, { data: ingresos }] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, codigo_avis, unidad_medida, stock_recomendado_default, stock_critico_default"
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("ingresos_stock_mes")
      .select(
        "id, fecha, cantidad, tipo_origen, referencia, observacion, medicamentos ( nombre, codigo_interno )"
      )
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .order("fecha", { ascending: false })
      .limit(40),
  ]);

  const meds =
    medicamentos?.map((m) => ({
      id: m.id as string,
      nombre: m.nombre as string,
      codigo_interno: m.codigo_interno as string,
      codigo_avis: (m.codigo_avis as string | null) ?? null,
      unidad_medida: String(m.unidad_medida ?? ""),
    })) ?? [];

  let ledgerPorMedicamento: Record<string, LedgerIngresoFila> = {};
  if (puedeRegistrar && meds.length > 0) {
    const medRows = (medicamentos ?? []) as Record<string, unknown>[];
    const medMins = medRows
      .filter((r) => typeof r.id === "string")
      .map((r) => ({
        id: r.id as string,
        stock_recomendado_default: toInt(r.stock_recomendado_default),
        stock_critico_default: toInt(r.stock_critico_default),
      }));
    const snapshot = await snapshotLedgerMesPosta(
      supabase,
      postaId,
      anio,
      mes,
      medMins
    );
    ledgerPorMedicamento = {};
    for (const [id, s] of snapshot) {
      ledgerPorMedicamento[id] = {
        stock_recomendado: s.stock_recomendado,
        stock_critico: s.stock_critico,
        disponible: s.disponible,
      };
    }
  }

  type MedJoin = { nombre?: string; codigo_interno?: string } | null;
  const rows =
    ingresos?.map((r) => {
      const med = r.medicamentos as MedJoin;
      const tipo = String(r.tipo_origen);
      return {
        id: String(r.id),
        fecha: String(r.fecha),
        cantidad: Number(r.cantidad),
        tipoLabel: ORIGEN_LABEL[tipo] ?? tipo,
        referencia: r.referencia ? String(r.referencia) : null,
        observacion: r.observacion ? String(r.observacion) : null,
        medNombre: med && typeof med === "object" ? String(med.nombre ?? "") : "—",
        medCodigo:
          med && typeof med === "object" ? String(med.codigo_interno ?? "") : "",
      };
    }) ?? [];

  const basePath = `/postas/${postaId}/ingresos`;

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title="Entradas de stock"
        description={
          puedeRegistrar
            ? "Registra aquí los medicamentos que ingresaron a la posta este mes."
            : cierre
              ? "El mes está cerrado. Para registrar o corregir ingresos, solicita la reapertura del período."
              : "No tienes permiso para registrar ingresos en este período."
        }
      />

      <PostaMesToolbar basePath={basePath} anio={anio} mes={mes} />

      {puedeRegistrar ? (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-primary/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PackagePlus className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Nuevo ingreso de stock</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {tituloMesChile(anio, mes)} · {meds.length} medicamentos disponibles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <IngresoStockLoteForm
              postaId={postaId}
              medicamentos={meds}
              mesContableYm={mesContableYm}
              ledgerPorMedicamento={ledgerPorMedicamento}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 dark:bg-amber-950/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 mt-0.5">
              <Lock className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                {cierre ? "Período cerrado" : "Sin permiso de carga"}
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                {cierre
                  ? `El mes de ${tituloMesChile(anio, mes)} ya fue cerrado. Los movimientos de este período están bloqueados. Si necesitas corregir algo, solicita la reapertura del período a administración.`
                  : "Tu perfil de usuario no tiene permiso para registrar entradas de stock. Contacta al administrador si crees que esto es un error."}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <History className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Historial de ingresos</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Últimos 40 registros · ordenados por fecha
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <UltimosIngresosTabla postaId={postaId} puedeRegistrar={puedeRegistrar} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
