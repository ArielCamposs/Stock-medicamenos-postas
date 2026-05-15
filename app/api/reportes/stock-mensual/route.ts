import { NextResponse } from "next/server";

import { requirePerfilUsuario } from "@/lib/auth/session";
import {
  compararMedicamentoPorCategoriaNombre,
  etiquetaMedicamentoCategoria,
  normalizarMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import {
  anioMesActual,
  etiquetaMes,
  fechaCalendarioEnZonaIANA,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";
import {
  buildStockMensualXlsxBuffer,
  POSTA_ROW_FILLS_ARGB,
  type StockMensualXlsxFila,
} from "@/lib/reportes/stock-mensual-xlsx";
import { snapshotLedgerMesPosta, type MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseYm(raw: string | null): { anio: number; mes: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [a, m] = raw.split("-").map(Number);
    if (a >= 2020 && a <= 2100 && m >= 1 && m <= 12) return { anio: a, mes: m };
  }
  return anioMesActual();
}

function toInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function GET(request: Request) {
  await requirePerfilUsuario();
  const supabase = await createServerSupabaseClient();
  const url = new URL(request.url);
  const { anio, mes } = parseYm(url.searchParams.get("ym"));
  const postaId = url.searchParams.get("postaId");

  const [{ data: postas }, { data: medicamentos }, { data: avisRows }] = await Promise.all([
    supabase
      .from("postas")
      .select("id, nombre, codigo")
      .eq("activa", true)
      .order("nombre"),
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, unidad_medida, categoria, stock_recomendado_default, stock_critico_default"
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("stock_avis_mensual")
      .select("posta_id, medicamento_id, stock_avis_cantidad")
      .eq("anio", anio)
      .eq("mes", mes),
  ]);

  const postasFiltradas = (postas ?? [])
    .filter((p) => !postaId || String(p.id) === postaId)
    .map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre ?? ""),
      codigo: p.codigo ? String(p.codigo) : "",
    }));

  type MedExport = {
    id: string;
    nombre: string;
    codigo: string;
    unidad: string;
    stock_recomendado_default: number;
    stock_critico_default: number;
    categoria: MedicamentoCategoria;
    categoriaEtiqueta: string;
  };

  const meds: MedExport[] = (medicamentos ?? [])
    .map((m) => {
      const r = m as Record<string, unknown>;
      if (typeof r.id !== "string") return null;
      const cat = normalizarMedicamentoCategoria(
        typeof r.categoria === "string" ? r.categoria : undefined
      );
      return {
        id: r.id,
        nombre: String(r.nombre ?? ""),
        codigo: String(r.codigo_interno ?? ""),
        unidad: String(r.unidad_medida ?? ""),
        stock_recomendado_default: toInt(r.stock_recomendado_default),
        stock_critico_default: toInt(r.stock_critico_default),
        categoria: cat,
        categoriaEtiqueta: etiquetaMedicamentoCategoria[cat],
      };
    })
    .filter((x): x is MedExport => x !== null);

  meds.sort((a, b) =>
    compararMedicamentoPorCategoriaNombre(
      a.categoria,
      a.nombre,
      b.categoria,
      b.nombre
    )
  );

  const avis = new Map<string, number>();
  for (const row of avisRows ?? []) {
    avis.set(`${row.posta_id}:${row.medicamento_id}`, toInt(row.stock_avis_cantidad));
  }

  const periodoEtiqueta = etiquetaMes(anio, mes);
  const fechaExportChile = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);

  const encabezados = [
    "N°",
    "Posta",
    "Código posta",
    "Año período",
    "Mes período",
    "Período (MM/AAAA)",
    "Categoría medicamento",
    "Medicamento",
    "Código interno",
    "Unidad de medida",
    "Stock posta",
    "Stock crítico",
    "Saldo cierre mes anterior",
    "Ingresos del mes",
    "Descuentos del mes",
    "Disponible según registro",
    "Stock AVIS el mes",
    "Diferencia AVIS menos registro",
    "Fecha exportación documento",
  ];

  const filasXlsx: StockMensualXlsxFila[] = [];

  const medsLedger: MedLedgerMin[] = meds.map((m) => ({
    id: m.id,
    stock_recomendado_default: m.stock_recomendado_default,
    stock_critico_default: m.stock_critico_default,
  }));

  let nro = 0;
  let postaIdx = 0;
  for (const posta of postasFiltradas) {
    const fillArgb =
      POSTA_ROW_FILLS_ARGB[postaIdx % POSTA_ROW_FILLS_ARGB.length] ?? "FFFFFFFF";
    postaIdx += 1;
    const snap = await snapshotLedgerMesPosta(
      supabase,
      posta.id,
      anio,
      mes,
      medsLedger
    );
    for (const med of meds) {
      const s = snap.get(med.id);
      if (!s) continue;
      nro += 1;
      const stockAvis = avis.get(`${posta.id}:${med.id}`) ?? 0;
      const cells: (string | number)[] = [
        nro,
        posta.nombre,
        posta.codigo,
        anio,
        mes,
        periodoEtiqueta,
        med.categoriaEtiqueta,
        med.nombre,
        med.codigo,
        med.unidad,
        s.stock_recomendado,
        s.stock_critico,
        s.cierre_mes_anterior,
        s.ingreso_mes,
        s.descuento_mes,
        s.disponible,
        stockAvis,
        stockAvis - s.disponible,
        fechaExportChile,
      ];
      filasXlsx.push({ fillArgb, cells });
    }
  }

  const buffer = await buildStockMensualXlsxBuffer(encabezados, filasXlsx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stock-mensual-${anio}-${String(mes).padStart(2, "0")}-detalle.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
