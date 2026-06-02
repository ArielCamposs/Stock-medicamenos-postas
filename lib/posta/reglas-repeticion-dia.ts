import {
  fechaCalendarioEnZonaIANA,
  rangoFechasMesISO,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** Fecha calendario (Chile) de un instante ISO guardado en base de datos. */
export function fechaOperacionDesdeIso(iso: string): string {
  return fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION, new Date(iso));
}

/**
 * Ya existe un lote de ingreso de medicamentos para esta posta en esa fecha.
 * Una recepción por día calendario; al día siguiente se puede volver a ingresar lo pendiente.
 */
export async function validarIngresoMedicamentosNoMismoDia(
  supabase: SupabaseSrv,
  postaId: string,
  fecha: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await supabase
    .from("ingresos_stock_lotes")
    .select("id")
    .eq("posta_id", postaId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (row && typeof row === "object" && "id" in row) {
    return {
      ok: false,
      error:
        "Ya registraste una recepción con esta fecha. Puedes ingresar lo que falte del pedido en otro día, o revisar el historial de abajo.",
    };
  }
  return { ok: true };
}

/**
 * No enviar un pedido de insumos nuevo el mismo día que otro pedido ya enviado
 * (corrección de un pedido OBSERVADO del mismo id sí se permite).
 */
export async function validarPedidoInsumosNoMismoDia(
  supabase: SupabaseSrv,
  postaId: string,
  pedidoIdActual: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);

  const { data } = await supabase
    .from("pedidos_insumos")
    .select("id, enviado_en")
    .eq("posta_id", postaId)
    .not("enviado_en", "is", null)
    .order("enviado_en", { ascending: false })
    .limit(30);

  if (!data || !Array.isArray(data)) return { ok: true };

  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id === pedidoIdActual) continue;
    const enviado = r.enviado_en;
    if (typeof enviado !== "string") continue;
    if (fechaOperacionDesdeIso(enviado) === hoy) {
      return {
        ok: false,
        error:
          "Ya enviaste un pedido de insumos hoy. Puedes armar otro mañana; las cantidades sugeridas usan tu stock actual.",
      };
    }
  }
  return { ok: true };
}

/** Fechas (YYYY-MM-DD) con al menos un lote de ingreso en el mes contable. */
export async function fechasConIngresoLoteEnMes(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number
): Promise<string[]> {
  const { desde, hasta } = rangoFechasMesISO(anio, mes);
  const { data } = await supabase
    .from("ingresos_stock_lotes")
    .select("fecha")
    .eq("posta_id", postaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const set = new Set<string>();
  if (data && Array.isArray(data)) {
    for (const row of data) {
      const f = (row as Record<string, unknown>).fecha;
      if (typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f)) set.add(f);
    }
  }
  return [...set].sort();
}

/** True si la posta ya envió algún pedido de insumos hoy (Chile), excluyendo el pedido en edición. */
export async function postaEnvioPedidoInsumosHoy(
  supabase: SupabaseSrv,
  postaId: string,
  pedidoIdExcluir: string | null
): Promise<boolean> {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const { data } = await supabase
    .from("pedidos_insumos")
    .select("id, enviado_en")
    .eq("posta_id", postaId)
    .not("enviado_en", "is", null)
    .order("enviado_en", { ascending: false })
    .limit(30);

  if (!data || !Array.isArray(data)) return false;

  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    if (pedidoIdExcluir && r.id === pedidoIdExcluir) continue;
    const enviado = r.enviado_en;
    if (typeof enviado !== "string") continue;
    if (fechaOperacionDesdeIso(enviado) === hoy) return true;
  }
  return false;
}

type TipoPedidoMensual = "GENERAL" | "CONTRA_RECETA";

/**
 * No enviar un pedido mensual (general o contra receta) el mismo día que otro del mismo tipo.
 * Reenviar un pedido OBSERVADO (mismo id) sí se permite.
 */
export async function validarPedidoMensualNoMismoDia(
  supabase: SupabaseSrv,
  postaId: string,
  tipo: TipoPedidoMensual,
  pedidoIdActual: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const etiqueta = tipo === "CONTRA_RECETA" ? "contra receta" : "general";

  const { data } = await supabase
    .from("pedidos_mensuales")
    .select("id, enviado_en")
    .eq("posta_id", postaId)
    .eq("tipo", tipo)
    .not("enviado_en", "is", null)
    .order("enviado_en", { ascending: false })
    .limit(40);

  if (!data || !Array.isArray(data)) return { ok: true };

  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id === pedidoIdActual) continue;
    const enviado = r.enviado_en;
    if (typeof enviado !== "string") continue;
    if (fechaOperacionDesdeIso(enviado) === hoy) {
      return {
        ok: false,
        error: `Ya enviaste el pedido ${etiqueta} hoy. Puedes enviar otro mañana si lo necesitas.`,
      };
    }
  }
  return { ok: true };
}

/** True si la posta ya envió un pedido mensual de ese tipo hoy (Chile). */
export async function postaEnvioPedidoMensualHoy(
  supabase: SupabaseSrv,
  postaId: string,
  tipo: TipoPedidoMensual,
  pedidoIdExcluir: string | null
): Promise<boolean> {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);

  const { data } = await supabase
    .from("pedidos_mensuales")
    .select("id, enviado_en")
    .eq("posta_id", postaId)
    .eq("tipo", tipo)
    .not("enviado_en", "is", null)
    .order("enviado_en", { ascending: false })
    .limit(40);

  if (!data || !Array.isArray(data)) return false;

  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    if (pedidoIdExcluir && r.id === pedidoIdExcluir) continue;
    const enviado = r.enviado_en;
    if (typeof enviado !== "string") continue;
    if (fechaOperacionDesdeIso(enviado) === hoy) return true;
  }
  return false;
}
