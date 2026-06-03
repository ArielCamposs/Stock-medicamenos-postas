import type { TipoPedido } from "@/app/actions/pedido-mensual";
import {
  esMedicamentoContraReceta,
  normalizarMedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { etiquetaInstanteChile24h } from "@/lib/domain/fecha-mes";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PedidoDespachadoActivoIngreso = {
  pedidoId: string;
  tipo: TipoPedido;
  despachadoEtiqueta: string;
  etiquetaTipo: string;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function rangoFechasMes(anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin =
    mes === 12
      ? `${anio + 1}-01-01`
      : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  return { inicio, fin };
}

/** Primer pedido DESPACHADO del mes (el que se despachó antes). */
export async function obtenerPedidoDespachadoActivoParaIngreso(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number
): Promise<PedidoDespachadoActivoIngreso | null> {
  const { data, error } = await supabase
    .from("pedidos_mensuales")
    .select("id, tipo, despachado_en")
    .eq("posta_id", postaId)
    .eq("anio", anio)
    .eq("mes", mes)
    .eq("estado", "DESPACHADO")
    .not("despachado_en", "is", null)
    .order("despachado_en", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  if (typeof row.id !== "string") return null;
  const desp =
    typeof row.despachado_en === "string" && row.despachado_en.length > 0
      ? row.despachado_en
      : null;
  if (!desp) return null;

  const tipo: TipoPedido = row.tipo === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL";
  return {
    pedidoId: row.id,
    tipo,
    despachadoEtiqueta: etiquetaInstanteChile24h(desp),
    etiquetaTipo: tipo === "CONTRA_RECETA" ? "contra receta" : "general",
  };
}

/** Cantidades pedidas y ya ingresadas (vía lotes con referencia al pedido) por medicamento. */
export async function cargarCantidadesPedidoActivoParaIngreso(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number,
  pedidoActivo: PedidoDespachadoActivoIngreso
): Promise<{
  cantidadPedidaPorMed: Record<string, number>;
  cantidadIngresadaPedidoPorMed: Record<string, number>;
}> {
  const { data: detalleRows, error: de } = await supabase
    .from("detalle_pedido_mensual")
    .select(
      `
      medicamento_id,
      cantidad_final,
      medicamentos ( categoria, es_contra_receta )
    `
    )
    .eq("pedido_id", pedidoActivo.pedidoId)
    .gt("cantidad_final", 0);

  const cantidadPedidaPorMed: Record<string, number> = {};
  if (!de && Array.isArray(detalleRows)) {
    for (const row of detalleRows) {
      const r = row as Record<string, unknown>;
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
      if (pedidoActivo.tipo === "CONTRA_RECETA" ? !esContra : esContra) {
        continue;
      }
      cantidadPedidaPorMed[r.medicamento_id] = toInt(r.cantidad_final);
    }
  }

  const { inicio, fin } = rangoFechasMes(anio, mes);
  const { data: ingresosPedido } = await supabase
    .from("ingresos_stock_mes")
    .select("medicamento_id, cantidad")
    .eq("posta_id", postaId)
    .eq("referencia", pedidoActivo.pedidoId)
    .gte("fecha", inicio)
    .lt("fecha", fin)
    .eq("anulado", false);

  const cantidadIngresadaPedidoPorMed: Record<string, number> = {};
  if (ingresosPedido && Array.isArray(ingresosPedido)) {
    for (const row of ingresosPedido) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        cantidadIngresadaPedidoPorMed[r.medicamento_id] =
          (cantidadIngresadaPedidoPorMed[r.medicamento_id] ?? 0) + toInt(r.cantidad);
      }
    }
  }

  return { cantidadPedidaPorMed, cantidadIngresadaPedidoPorMed };
}

type LineaIngresoPedido = { medicamentoId: string; cantidad: number };

async function cargarMapaPedidoDespachado(
  supabase: SupabaseSrv,
  postaId: string,
  pedidoId: string
): Promise<
  | { ok: true; tipoPedido: TipoPedido; pedidoPorMed: Map<string, { pedido: number; recibido: number }> }
  | { ok: false; error: string }
  | { ok: true; omitir: true }
> {
  const { data: pedido, error: pe } = await supabase
    .from("pedidos_mensuales")
    .select("id, estado, tipo")
    .eq("id", pedidoId)
    .eq("posta_id", postaId)
    .maybeSingle();

  if (pe || !pedido || typeof pedido !== "object") {
    return { ok: false, error: "No se encontró el pedido despachado." };
  }

  const estado = String((pedido as { estado: string }).estado);
  if (estado !== "DESPACHADO") {
    return { ok: true, omitir: true };
  }

  const tipoPedido: TipoPedido =
    (pedido as { tipo?: string }).tipo === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL";

  const { data: detalleRows, error: de } = await supabase
    .from("detalle_pedido_mensual")
    .select(
      `
      medicamento_id,
      cantidad_final,
      cantidad_recibida,
      medicamentos ( categoria, es_contra_receta )
    `
    )
    .eq("pedido_id", pedidoId);

  if (de) return { ok: false, error: de.message };

  const pedidoPorMed = new Map<string, { pedido: number; recibido: number }>();
  if (Array.isArray(detalleRows)) {
    for (const row of detalleRows) {
      const r = row as Record<string, unknown>;
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
      const pedidoQty = Math.max(0, toInt(r.cantidad_final));
      if (pedidoQty <= 0) continue;
      pedidoPorMed.set(r.medicamento_id, {
        pedido: pedidoQty,
        recibido: Math.max(0, toInt(r.cantidad_recibida)),
      });
    }
  }

  return { ok: true, tipoPedido, pedidoPorMed };
}

function validarLineasContraMapaPedido(
  pedidoPorMed: Map<string, { pedido: number; recibido: number }>,
  lineas: LineaIngresoPedido[],
  tipoPedido: TipoPedido
): { ok: true } | { ok: false; error: string } {
  for (const l of lineas) {
    const info = pedidoPorMed.get(l.medicamentoId);
    if (!info) {
      const etiqueta = tipoPedido === "CONTRA_RECETA" ? "contra receta" : "general";
      return {
        ok: false,
        error: `Hay medicamentos en el ingreso que no pertenecen al pedido ${etiqueta} despachado activo. Usa «Solo ítems del pedido» o revisa las cantidades.`,
      };
    }
    const nuevoTotal = info.recibido + l.cantidad;
    if (nuevoTotal > info.pedido) {
      return {
        ok: false,
        error:
          "La cantidad ingresada supera lo pedido en algún medicamento. Revisa las cantidades.",
      };
    }
    info.recibido = nuevoTotal;
    pedidoPorMed.set(l.medicamentoId, info);
  }
  return { ok: true };
}

/** Valida antes de insertar stock (evita ingreso huérfano si el pedido rechaza líneas). */
export async function validarLineasIngresoPedidoDespachado(
  supabase: SupabaseSrv,
  postaId: string,
  pedidoId: string,
  lineas: LineaIngresoPedido[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mapa = await cargarMapaPedidoDespachado(supabase, postaId, pedidoId);
  if (!mapa.ok) return mapa;
  if ("omitir" in mapa) return { ok: true };
  return validarLineasContraMapaPedido(mapa.pedidoPorMed, lineas, mapa.tipoPedido);
}

export async function aplicarIngresoLotePedidoDespachadoActivo(
  supabase: SupabaseSrv,
  input: {
    postaId: string;
    anio: number;
    mes: number;
    pedidoId: string;
    lineas: LineaIngresoPedido[];
  }
): Promise<{ ok: true; pedidoCompletado: boolean } | { ok: false; error: string }> {
  const mapa = await cargarMapaPedidoDespachado(supabase, input.postaId, input.pedidoId);
  if (!mapa.ok) return mapa;
  if ("omitir" in mapa) {
    return { ok: true, pedidoCompletado: false };
  }

  const pedidoPorMed = mapa.pedidoPorMed;
  const val = validarLineasContraMapaPedido(pedidoPorMed, input.lineas, mapa.tipoPedido);
  if (!val.ok) return val;

  for (const [medicamentoId, info] of pedidoPorMed) {
    if (info.pedido <= 0) continue;
    const { error: upDet } = await supabase
      .from("detalle_pedido_mensual")
      .update({ cantidad_recibida: info.recibido })
      .eq("pedido_id", input.pedidoId)
      .eq("medicamento_id", medicamentoId);
    if (upDet) return { ok: false, error: upDet.message };
  }

  let pedidoCompletado = pedidoPorMed.size > 0;
  for (const info of pedidoPorMed.values()) {
    if (info.recibido < info.pedido) {
      pedidoCompletado = false;
      break;
    }
  }

  if (pedidoCompletado) {
    const now = new Date().toISOString();
    const { data: updRows, error: upPed } = await supabase
      .from("pedidos_mensuales")
      .update({
        estado: "RECIBIDO",
        recibido_en: now,
        comentario_posta: null,
      })
      .eq("id", input.pedidoId)
      .eq("posta_id", input.postaId)
      .eq("estado", "DESPACHADO")
      .select("id");

    if (upPed) return { ok: false, error: upPed.message };
    if (!updRows?.length) {
      return { ok: false, error: "No se pudo cerrar el pedido como recibido. Recarga la página." };
    }
  }

  return { ok: true, pedidoCompletado };
}
