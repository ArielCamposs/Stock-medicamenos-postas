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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Ingresos de stock
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {puedeRegistrar ? (
            <>Mes, cantidades y guardar.</>
          ) : cierre ? (
            <>Mes cerrado. Solicita reapertura antes de registrar o corregir ingresos.</>
          ) : (
            <>Solo lectura.</>
          )}
        </p>
      </div>

      {puedeRegistrar ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo ingreso</CardTitle>
          </CardHeader>
          <CardContent>
            <IngresoStockLoteForm
              postaId={postaId}
              medicamentos={meds}
              mesContableYm={mesContableYm}
              ledgerPorMedicamento={ledgerPorMedicamento}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Sin permiso de carga</CardTitle>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Últimos ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <UltimosIngresosTabla postaId={postaId} puedeRegistrar={puedeRegistrar} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
