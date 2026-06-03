import type { TipoPedido } from "@/app/actions/pedido-mensual";
import { fechaIngresoParaMesMovimiento } from "@/lib/domain/fecha-mes";
import { validarMesAbierto } from "@/lib/posta/sincronizar-stock-mensual-desde-registro";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type LineaRecepcionInput = {
  medicamentoId: string;
  cantidadRecibida: number;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function parseLineasRecepcionDesdeFormulario(
  formData: FormData,
  medicamentoIds: string[]
): { ok: true; lineas: LineaRecepcionInput[] } | { ok: false; error: string } {
  const lineas: LineaRecepcionInput[] = [];
  for (const medicamentoId of medicamentoIds) {
    const raw = formData.get(`recibido_${medicamentoId}`)?.toString() ?? "";
    const t = raw.trim();
    if (t === "") continue;
    const n = Number.parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) {
      return {
        ok: false,
        error: "Las cantidades recibidas deben ser números enteros mayores o iguales a 0.",
      };
    }
    lineas.push({ medicamentoId, cantidadRecibida: n });
  }
  return { ok: true, lineas };
}

async function obtenerLoteIngresoDia(
  supabase: SupabaseSrv,
  postaId: string,
  fecha: string,
  userId: string
): Promise<{ ok: true; loteId: string } | { ok: false; error: string }> {
  const { data: existente } = await supabase
    .from("ingresos_stock_lotes")
    .select("id")
    .eq("posta_id", postaId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (
    existente &&
    typeof existente === "object" &&
    typeof (existente as { id: unknown }).id === "string"
  ) {
    return { ok: true, loteId: (existente as { id: string }).id };
  }

  const { data: created, error } = await supabase
    .from("ingresos_stock_lotes")
    .insert({
      posta_id: postaId,
      fecha,
      tipo_origen: "TRASLADO",
      referencia: null,
      observacion: null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (
    error ||
    !created ||
    typeof created !== "object" ||
    typeof (created as { id: unknown }).id !== "string"
  ) {
    return { ok: false, error: error?.message ?? "No se pudo registrar el ingreso." };
  }

  return { ok: true, loteId: (created as { id: string }).id };
}

export async function registrarRecepcionPedidoMensual(
  supabase: SupabaseSrv,
  input: {
    postaId: string;
    pedidoId: string;
    userId: string;
    anio: number;
    mes: number;
    tipoPedido: TipoPedido;
    lineasRecibidas: LineaRecepcionInput[];
  }
): Promise<
  | {
      ok: true;
      nLineasStock: number;
      totalUnidades: number;
    }
  | { ok: false; error: string }
> {
  const { data: pedido, error: pe } = await supabase
    .from("pedidos_mensuales")
    .select("id, posta_id, anio, mes, estado, tipo")
    .eq("id", input.pedidoId)
    .eq("posta_id", input.postaId)
    .maybeSingle();

  if (pe || !pedido || typeof pedido !== "object") {
    return { ok: false, error: "No se encontró el pedido." };
  }

  const estado = String((pedido as { estado: string }).estado);
  if (estado !== "DESPACHADO") {
    return { ok: false, error: "Este pedido no está pendiente de confirmación de recepción." };
  }

  const anioPed = toInt((pedido as { anio: unknown }).anio);
  const mesPed = toInt((pedido as { mes: unknown }).mes);
  const abierto = await validarMesAbierto(supabase, input.postaId, anioPed, mesPed);
  if (!abierto.ok) return { ok: false, error: abierto.error };

  const { data: detalleRows, error: de } = await supabase
    .from("detalle_pedido_mensual")
    .select("medicamento_id, cantidad_final")
    .eq("pedido_id", input.pedidoId);

  if (de) return { ok: false, error: de.message };

  const pedidoPorMed = new Map<string, number>();
  if (Array.isArray(detalleRows)) {
    for (const row of detalleRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        pedidoPorMed.set(r.medicamento_id, Math.max(0, toInt(r.cantidad_final)));
      }
    }
  }

  for (const l of input.lineasRecibidas) {
    const pedidoQty = pedidoPorMed.get(l.medicamentoId);
    if (pedidoQty === undefined) {
      return { ok: false, error: "Hay medicamentos en el formulario que no pertenecen a este pedido." };
    }
    if (l.cantidadRecibida > pedidoQty) {
      return {
        ok: false,
        error:
          "La cantidad recibida no puede ser mayor que la cantidad pedida en ese medicamento.",
      };
    }
  }

  const lineasStock = input.lineasRecibidas.filter((l) => l.cantidadRecibida > 0);
  if (lineasStock.length === 0) {
    return {
      ok: false,
      error:
        "Indica al menos una cantidad recibida mayor que 0, o usa «No me llegó» si no recibiste nada.",
    };
  }

  const mesYm = `${anioPed}-${String(mesPed).padStart(2, "0")}`;
  const fecha =
    fechaIngresoParaMesMovimiento(mesYm, new Date()) ??
    `${anioPed}-${String(mesPed).padStart(2, "0")}-01`;

  const etiquetaTipo = input.tipoPedido === "CONTRA_RECETA" ? "contra receta" : "general";
  const lote = await obtenerLoteIngresoDia(supabase, input.postaId, fecha, input.userId);
  if (!lote.ok) return lote;

  const observacion = `Recepción pedido ${etiquetaTipo} (${input.pedidoId.slice(0, 8)}…)`;

  const { error: insErr } = await supabase.from("ingresos_stock_mes").insert(
    lineasStock.map((l) => ({
      posta_id: input.postaId,
      medicamento_id: l.medicamentoId,
      lote_id: lote.loteId,
      fecha,
      cantidad: l.cantidadRecibida,
      tipo_origen: "TRASLADO" as const,
      referencia: input.pedidoId,
      observacion,
      created_by: input.userId,
    }))
  );

  if (insErr) return { ok: false, error: insErr.message };

  const { sincronizarStockMensualLote } = await import(
    "@/lib/posta/sincronizar-stock-mensual-desde-registro"
  );
  const sync = await sincronizarStockMensualLote(
    supabase,
    input.postaId,
    lineasStock.map((l) => l.medicamentoId),
    anioPed,
    mesPed
  );
  if (sync.error) return { ok: false, error: sync.error };

  for (const l of input.lineasRecibidas) {
    const pedidoQty = pedidoPorMed.get(l.medicamentoId) ?? 0;
    if (pedidoQty <= 0) continue;
    const { error: upDet } = await supabase
      .from("detalle_pedido_mensual")
      .update({ cantidad_recibida: l.cantidadRecibida })
      .eq("pedido_id", input.pedidoId)
      .eq("medicamento_id", l.medicamentoId);
    if (upDet) return { ok: false, error: upDet.message };
  }

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
    return { ok: false, error: "No se pudo confirmar la recepción. Recarga la página." };
  }

  const totalUnidades = lineasStock.reduce((a, l) => a + l.cantidadRecibida, 0);
  return {
    ok: true,
    nLineasStock: lineasStock.length,
    totalUnidades,
  };
}
