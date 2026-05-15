import {
  ConsumoMensualPanel,
  type ConsumoMensualMedPayload,
} from "@/components/posta/consumo-mensual-panel";
import { UltimosConsumosTabla } from "@/components/posta/ultimos-consumos-tabla";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  esAdminGeneral,
  puedeRegistrarOperacionesPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import {
  anioMesActual,
  fechaISOEnMes,
  rangoFechasMesISO,
} from "@/lib/domain/fecha-mes";
import {
  compararMedicamentoPorCategoriaNombre,
  normalizarMedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { snapshotLedgerMesPosta } from "@/lib/posta/snapshot-ledger-mes-posta";
import { obtenerCierreMensualPosta } from "@/lib/posta/cierre-mensual";
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
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export default async function PostaDescuentoPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);

  const { profile } = await requirePerfilUsuario();
  const puedeRegistrarPorRol = puedeRegistrarOperacionesPosta(profile, postaId);
  const supabase = await createServerSupabaseClient();
  const cierre = await obtenerCierreMensualPosta(supabase, postaId, anio, mes);
  const puedeRegistrar = puedeRegistrarPorRol && !cierre;
  const soloLecturaDescuentoVariante = !puedeRegistrar
    ? esAdminGeneral(profile)
      ? ("admin" as const)
      : ("resto" as const)
    : undefined;

  const { desde, hasta, diasEnMes: nDias } = rangoFechasMesISO(anio, mes);
  const basePath = `/postas/${postaId}/descuento`;

  const [
    { data: medicamentos },
    { data: curStock },
    { data: movs },
    { data: movimientos },
    { data: avisRows },
  ] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, codigo_avis, unidad_medida, categoria, stock_recomendado_default, stock_critico_default"
      )
      .eq("activo", true)
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase
      .from("stock_mensual_posta")
      .select("medicamento_id, stock_recomendado_config, stock_critico_config")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("movimientos_diarios_consumo")
      .select(
        "medicamento_id, fecha, cantidad_con_avis, cantidad_sin_avis, total_dia, observacion"
      )
      .eq("posta_id", postaId)
      .eq("anulado", false)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    (() => {
      const desde14 = new Date();
      desde14.setDate(desde14.getDate() - 14);
      const desdeStr = desde14.toISOString().slice(0, 10);
      return supabase
        .from("movimientos_diarios_consumo")
        .select(
          "id, medicamento_id, fecha, cantidad_con_avis, cantidad_sin_avis, total_dia, observacion, medicamentos ( nombre, codigo_interno, unidad_medida )"
        )
        .eq("posta_id", postaId)
        .eq("anulado", false)
        .gte("fecha", desdeStr)
        .order("fecha", { ascending: false })
        .limit(80);
    })(),
    supabase
      .from("stock_avis_mensual")
      .select("medicamento_id, stock_avis_cantidad")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
  ]);

  const avisPorMed = new Map<string, number>();
  if (avisRows && Array.isArray(avisRows)) {
    for (const row of avisRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        avisPorMed.set(r.medicamento_id, toInt(r.stock_avis_cantidad));
      }
    }
  }

  type MedRow = {
    id: string;
    nombre: string;
    codigo_interno: string;
    codigo_avis: string | null;
    unidad_medida: string;
    categoria: ReturnType<typeof normalizarMedicamentoCategoria>;
    stock_recomendado_default: number;
    stock_critico_default: number;
  };

  const meds: MedRow[] = [];
  if (medicamentos && Array.isArray(medicamentos)) {
    for (const row of medicamentos) {
      const r = row as Record<string, unknown>;
      if (
        typeof r.id === "string" &&
        typeof r.nombre === "string" &&
        typeof r.codigo_interno === "string" &&
        typeof r.unidad_medida === "string"
      ) {
        meds.push({
          id: r.id,
          nombre: r.nombre,
          codigo_interno: r.codigo_interno,
          codigo_avis:
            r.codigo_avis === null || typeof r.codigo_avis === "string"
              ? r.codigo_avis
              : null,
          unidad_medida: r.unidad_medida,
          categoria: normalizarMedicamentoCategoria(
            typeof r.categoria === "string" ? r.categoria : undefined
          ),
          stock_recomendado_default: toInt(r.stock_recomendado_default),
          stock_critico_default: toInt(r.stock_critico_default),
        });
      }
    }
  }

  meds.sort((a, b) =>
    compararMedicamentoPorCategoriaNombre(
      a.categoria,
      a.nombre,
      b.categoria,
      b.nombre
    )
  );

  const snapshot = await snapshotLedgerMesPosta(
    supabase,
    postaId,
    anio,
    mes,
    meds.map((m) => ({
      id: m.id,
      stock_recomendado_default: m.stock_recomendado_default,
      stock_critico_default: m.stock_critico_default,
    })),
    {
      curStockRows: curStock ?? [],
      movsMesRows: movs ?? [],
    }
  );

  const byMedFecha = new Map<
    string,
    Map<string, { con: number; sin: number; total: number; observacion: string | null }>
  >();

  if (movs && Array.isArray(movs)) {
    for (const row of movs) {
      const r = row as Record<string, unknown>;
      const mid = r.medicamento_id;
      const f = r.fecha;
      if (typeof mid !== "string" || typeof f !== "string") continue;
      const con = toInt(r.cantidad_con_avis);
      const sin = toInt(r.cantidad_sin_avis);
      const total = toInt(r.total_dia);
      const obsRaw = r.observacion;
      const observacion =
        typeof obsRaw === "string"
          ? obsRaw.trim() || null
          : obsRaw != null && String(obsRaw).trim()
            ? String(obsRaw).trim()
            : null;
      if (!byMedFecha.has(mid)) byMedFecha.set(mid, new Map());
      byMedFecha.get(mid)!.set(f, { con, sin, total, observacion });
    }
  }

  const payload: ConsumoMensualMedPayload[] = meds.map((m) => {
    const s = snapshot.get(m.id)!;

    const dias: ConsumoMensualMedPayload["dias"] = [];
    for (let dia = 1; dia <= nDias; dia++) {
      const fechaISO = fechaISOEnMes(anio, mes, dia);
      const cell = byMedFecha.get(m.id)?.get(fechaISO);
      dias.push({
        dia,
        fechaISO,
        con: cell?.con ?? 0,
        sin: cell?.sin ?? 0,
        total: cell?.total ?? 0,
        observacion: cell?.observacion ?? null,
      });
    }

    return {
      id: m.id,
      nombre: m.nombre,
      codigo_interno: m.codigo_interno,
      codigo_avis: m.codigo_avis,
      unidad_medida: m.unidad_medida,
      categoria: m.categoria,
      stock_recomendado: s.stock_recomendado,
      stock_critico: s.stock_critico,
      cierre_mes_anterior: s.cierre_mes_anterior,
      ingreso_mes: s.ingreso_mes,
      descuento_acumulado_mes: s.descuento_mes,
      stock_declarado_avis: avisPorMed.get(m.id) ?? 0,
      disponible: s.disponible,
      dias,
    };
  });

  type MedJoin = {
    nombre?: string;
    codigo_interno?: string;
    unidad_medida?: string;
  } | null;
  const rows =
    movimientos?.map((r) => {
      const med = r.medicamentos as MedJoin;
      const obs = r.observacion;
      const observacion =
        typeof obs === "string"
          ? obs.trim() || null
          : obs != null && String(obs).trim()
            ? String(obs).trim()
            : null;
      const mid = String(r.medicamento_id);
      const snap = snapshot.get(mid);
      return {
        id: String(r.id),
        medicamentoId: mid,
        fecha: String(r.fecha),
        conAvis: Number(r.cantidad_con_avis),
        sinAvis: Number(r.cantidad_sin_avis),
        total: Number(r.total_dia),
        observacion,
        medNombre: med && typeof med === "object" ? String(med.nombre ?? "") : "—",
        medCodigo:
          med && typeof med === "object" ? String(med.codigo_interno ?? "") : "",
        unidadMedida:
          med && typeof med === "object" ? String(med.unidad_medida ?? "") : "",
        disponibleMes: snap?.disponible ?? 0,
        stockCritico: snap?.stock_critico ?? 0,
        stockRecomendado: snap?.stock_recomendado ?? 0,
      };
    }) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Descuento diario
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold sm:text-xl md:text-2xl">
            Descuento por mes ·{" "}
            <span className="tabular-nums">
              {String(mes).padStart(2, "0")}/{anio}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConsumoMensualPanel
            postaId={postaId}
            basePath={basePath}
            anio={anio}
            mes={mes}
            puedeRegistrar={puedeRegistrar}
            soloLecturaDescuentoVariante={soloLecturaDescuentoVariante}
            medicamentos={payload}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <UltimosConsumosTabla
            postaId={postaId}
            puedeRegistrar={puedeRegistrar}
            rows={rows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
