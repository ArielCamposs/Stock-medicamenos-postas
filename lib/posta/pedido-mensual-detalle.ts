import {
  compararMedicamentoPorCategoriaNombre,
  esMedicamentoContraReceta,
  normalizarMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PedidoMensualDetalleLinea = {
  medicamentoId: string;
  nombre: string;
  codigo_interno: string;
  unidad_medida: string;
  categoria: MedicamentoCategoria;
  cantidad_sugerida: number;
  cantidad_final: number;
};

export type PedidoMensualDetallePayload = {
  pedidoId: string;
  postaId: string;
  postaNombre: string;
  postaCodigo: string | null;
  anio: number;
  mes: number;
  estado: string;
  tipo: "GENERAL" | "CONTRA_RECETA";
  enviadoEn: string | null;
  comentarioAdmin: string | null;
  lineas: PedidoMensualDetalleLinea[];
  totalUnidades: number;
  nMedicamentos: number;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function cargarDetallePedidoMensual(
  supabase: SupabaseSrv,
  pedidoId: string
): Promise<{ ok: true; data: PedidoMensualDetallePayload } | { ok: false; error: string; status: number }> {
  const { data: pedido, error: pe } = await supabase
    .from("pedidos_mensuales")
    .select(
      "id, posta_id, anio, mes, estado, tipo, enviado_en, comentario_admin"
    )
    .eq("id", pedidoId)
    .maybeSingle();

  if (pe || !pedido || typeof pedido !== "object") {
    return { ok: false, error: "Pedido no encontrado.", status: 404 };
  }

  const row = pedido as Record<string, unknown>;
  const postaId = typeof row.posta_id === "string" ? row.posta_id : "";
  if (!postaId) {
    return { ok: false, error: "Pedido inválido.", status: 404 };
  }

  const { data: postaRow } = await supabase
    .from("postas")
    .select("nombre, codigo")
    .eq("id", postaId)
    .maybeSingle();

  const postaNombre =
    postaRow && typeof postaRow === "object" && typeof (postaRow as { nombre?: unknown }).nombre === "string"
      ? (postaRow as { nombre: string }).nombre.trim() || "Posta"
      : "Posta";
  const postaCodigoRaw = postaRow && typeof postaRow === "object" ? (postaRow as { codigo?: unknown }).codigo : null;
  const postaCodigo =
    postaCodigoRaw === null || typeof postaCodigoRaw === "string" ? postaCodigoRaw : null;

  const { data: detalles, error: de } = await supabase
    .from("detalle_pedido_mensual")
    .select(
      `
      medicamento_id,
      cantidad_sugerida,
      cantidad_final,
      medicamentos (
        nombre,
        codigo_interno,
        unidad_medida,
        categoria,
        es_contra_receta
      )
    `
    )
    .eq("pedido_id", pedidoId)
    .gt("cantidad_final", 0);

  if (de) {
    return { ok: false, error: de.message ?? "No se pudo cargar el detalle.", status: 500 };
  }

  const tipoRaw = typeof row.tipo === "string" ? row.tipo : "GENERAL";
  const tipoPedido: "GENERAL" | "CONTRA_RECETA" =
    tipoRaw === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL";

  const lineas: PedidoMensualDetalleLinea[] = [];
  for (const d of detalles ?? []) {
    const r = d as Record<string, unknown>;
    if (typeof r.medicamento_id !== "string") continue;
    const medRaw = r.medicamentos;
    const med =
      medRaw && typeof medRaw === "object" && !Array.isArray(medRaw)
        ? (medRaw as Record<string, unknown>)
        : null;
    const cat = normalizarMedicamentoCategoria(
      med && typeof med.categoria === "string" ? med.categoria : undefined
    );
    const esContra = esMedicamentoContraReceta({
      es_contra_receta: med?.es_contra_receta === true,
      categoria: cat,
    });
    if (tipoPedido === "CONTRA_RECETA" ? !esContra : esContra) {
      continue;
    }
    lineas.push({
      medicamentoId: r.medicamento_id,
      nombre: med && typeof med.nombre === "string" ? med.nombre : "—",
      codigo_interno:
        med && typeof med.codigo_interno === "string" ? med.codigo_interno : "—",
      unidad_medida:
        med && typeof med.unidad_medida === "string" ? med.unidad_medida : "",
      categoria: cat,
      cantidad_sugerida: toInt(r.cantidad_sugerida),
      cantidad_final: toInt(r.cantidad_final),
    });
  }

  lineas.sort((a, b) =>
    compararMedicamentoPorCategoriaNombre(a.categoria, a.nombre, b.categoria, b.nombre)
  );

  const totalUnidades = lineas.reduce((acc, l) => acc + l.cantidad_final, 0);
  const enviadoEn =
    row.enviado_en === null || typeof row.enviado_en === "string"
      ? (row.enviado_en as string | null)
      : null;
  const comentarioAdmin =
    row.comentario_admin === null || typeof row.comentario_admin === "string"
      ? (row.comentario_admin as string | null)
      : null;

  return {
    ok: true,
    data: {
      pedidoId,
      postaId,
      postaNombre,
      postaCodigo,
      anio: toInt(row.anio),
      mes: toInt(row.mes),
      estado: typeof row.estado === "string" ? row.estado : "ENVIADO",
      tipo: tipoPedido,
      enviadoEn,
      comentarioAdmin,
      lineas,
      totalUnidades,
      nMedicamentos: lineas.length,
    },
  };
}
